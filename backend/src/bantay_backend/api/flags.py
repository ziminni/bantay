"""Behavior flags: queue, review decisions, counts and detection incidents."""

from __future__ import annotations

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import BehaviorFlag, Camera, EntryLog, FlagStatus, FlagType, Lab
from ..schemas import (
    EntryPersonRead,
    FlagCounts,
    FlagCreate,
    FlagEvidence,
    FlagPersonRead,
    FlagRead,
    FlagReview,
    FlagStatusLiteral,
    FlagTypeLiteral,
)

router = APIRouter(prefix="/flags", tags=["Behavior Flags"])


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _build_flag_read(db: Session, flag: BehaviorFlag) -> FlagRead:
    """Format BehaviorFlag model into FlagRead schema with computed persons_inside."""
    # Find entries in the 3 hours before occurred_at
    since = flag.occurred_at - dt.timedelta(hours=3)
    entries = db.execute(
        select(EntryLog)
        .options(joinedload(EntryLog.person))
        .where(
            EntryLog.lab_id == flag.lab_id,
            EntryLog.entered_at >= since,
            EntryLog.entered_at <= flag.occurred_at,
        )
        .order_by(EntryLog.entered_at.desc())
        .limit(50)
    ).scalars().all()

    seen_persons: set[int] = set()
    persons_inside: list[FlagPersonRead] = []
    responsible_ids = set(flag.responsible_entry_ids or [])

    for e in entries:
        if e.person_id is not None:
            if e.person_id in seen_persons:
                continue
            seen_persons.add(e.person_id)

        person_dto = None
        if e.person:
            person_dto = EntryPersonRead(
                id=e.person.id,
                id_number=e.person.id_number,
                full_name=e.person.full_name,
                person_type=e.person.person_type,
            )

        persons_inside.append(
            FlagPersonRead(
                entry_id=e.id,
                entered_at=e.entered_at,
                person=person_dto,
                responsible=e.id in responsible_ids,
            )
        )
        if len(persons_inside) >= 8:
            break

    evidence_dict = flag.evidence if isinstance(flag.evidence, dict) else {}
    evidence = FlagEvidence(**evidence_dict)

    snapshot_path = flag.snapshot_path
    if not snapshot_path and flag.type == FlagType.UNKNOWN_PERSON:
        for e in entries:
            if e.snapshot_path:
                snapshot_path = e.snapshot_path
                break

    return FlagRead(
        id=flag.id,
        type=flag.type,
        status=flag.status,
        occurred_at=flag.occurred_at,
        lab_id=flag.lab_id,
        lab_name=flag.lab.name if flag.lab else None,
        camera_id=flag.camera_id,
        camera_name=flag.camera.name if flag.camera else None,
        evidence=evidence,
        snapshot_path=snapshot_path,
        clip_path=flag.clip_path,
        trigger_offset=flag.trigger_offset,
        persons_inside=persons_inside,
        reviewed_by=flag.reviewed_by,
        reviewed_at=flag.reviewed_at,
        review_note=flag.review_note,
    )


@router.get("", response_model=list[FlagRead])
def list_flags(
    status: FlagStatusLiteral | None = None,
    type: FlagTypeLiteral | None = None,
    lab_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[FlagRead]:
    """List behaviour flags, newest first, with optional status, type, and lab filters."""
    query = select(BehaviorFlag).options(
        joinedload(BehaviorFlag.lab),
        joinedload(BehaviorFlag.camera),
    )
    if status is not None:
        query = query.where(BehaviorFlag.status == status)
    if type is not None:
        query = query.where(BehaviorFlag.type == type)
    if lab_id is not None:
        query = query.where(BehaviorFlag.lab_id == lab_id)

    query = query.order_by(BehaviorFlag.occurred_at.desc())
    flags = db.execute(query).scalars().all()
    return [_build_flag_read(db, f) for f in flags]


@router.get("/counts", response_model=FlagCounts)
def get_flag_counts(
    lab_id: int | None = None,
    db: Session = Depends(get_db),
) -> FlagCounts:
    """Return counts of flags by status (PENDING, CONFIRMED, DISMISSED)."""
    query = select(BehaviorFlag.status, func.count(BehaviorFlag.id)).group_by(
        BehaviorFlag.status
    )
    if lab_id is not None:
        query = query.where(BehaviorFlag.lab_id == lab_id)

    rows = db.execute(query).all()
    counts = {"PENDING": 0, "CONFIRMED": 0, "DISMISSED": 0}
    for status_val, c in rows:
        if status_val in counts:
            counts[status_val] = c
    return FlagCounts(**counts)


@router.get("/{flag_id}", response_model=FlagRead)
def get_flag(
    flag_id: int,
    db: Session = Depends(get_db),
) -> FlagRead:
    """Get single behavior flag by ID."""
    flag = db.execute(
        select(BehaviorFlag)
        .options(
            joinedload(BehaviorFlag.lab),
            joinedload(BehaviorFlag.camera),
        )
        .where(BehaviorFlag.id == flag_id)
    ).scalar_one_or_none()

    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flag not found.",
        )
    return _build_flag_read(db, flag)


@router.patch("/{flag_id}", response_model=FlagRead)
def review_flag(
    flag_id: int,
    review: FlagReview,
    db: Session = Depends(get_db),
) -> FlagRead:
    """Confirm or dismiss a flag, recording the reviewer's decision and responsible parties."""
    flag = db.execute(
        select(BehaviorFlag)
        .options(
            joinedload(BehaviorFlag.lab),
            joinedload(BehaviorFlag.camera),
        )
        .where(BehaviorFlag.id == flag_id)
    ).scalar_one_or_none()

    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flag not found.",
        )

    flag.status = review.status
    flag.review_note = review.note.strip() if review.note else None
    flag.reviewed_by = "Administrator"
    flag.reviewed_at = _utcnow()
    flag.responsible_entry_ids = (
        review.responsible_entry_ids if review.status == "CONFIRMED" else []
    )

    db.commit()
    db.refresh(flag)
    return _build_flag_read(db, flag)


@router.post("/{flag_id}/reopen", response_model=FlagRead)
def reopen_flag(
    flag_id: int,
    db: Session = Depends(get_db),
) -> FlagRead:
    """Move a reviewed flag back to PENDING status."""
    flag = db.execute(
        select(BehaviorFlag)
        .options(
            joinedload(BehaviorFlag.lab),
            joinedload(BehaviorFlag.camera),
        )
        .where(BehaviorFlag.id == flag_id)
    ).scalar_one_or_none()

    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flag not found.",
        )

    flag.status = FlagStatus.PENDING
    flag.reviewed_by = None
    flag.reviewed_at = None

    db.commit()
    db.refresh(flag)
    return _build_flag_read(db, flag)


@router.post("", response_model=FlagRead, status_code=status.HTTP_201_CREATED)
def create_flag(
    body: FlagCreate,
    db: Session = Depends(get_db),
) -> FlagRead:
    """Create a new behavior flag (used by behavior analysis or testing)."""
    lab = db.get(Lab, body.lab_id)
    if not lab:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab not found.",
        )

    occurred = body.occurred_at or _utcnow()
    flag = BehaviorFlag(
        type=body.type,
        status=FlagStatus.PENDING,
        occurred_at=occurred,
        lab_id=body.lab_id,
        camera_id=body.camera_id,
        evidence=body.evidence.model_dump(),
        snapshot_path=body.snapshot_path,
        clip_path=body.clip_path,
        trigger_offset=body.trigger_offset,
        responsible_entry_ids=[],
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return _build_flag_read(db, flag)
