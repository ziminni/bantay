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


def seed_sample_flags(db: Session) -> list[BehaviorFlag]:
    """Seed initial sample flags when the table is empty so review screens work immediately."""
    labs = db.execute(select(Lab).order_by(Lab.id)).scalars().all()
    if not labs:
        return []

    cameras = db.execute(select(Camera).order_by(Camera.id)).scalars().all()
    now = _utcnow()

    sample_templates = [
        {
            "type": FlagType.RUNNING,
            "minutes_ago": 4,
            "prefer_role": "ROOM",
            "trigger": 2.6,
            "evidence": {
                "rule_set": "Pose",
                "metric": "Hip speed",
                "value": 2.14,
                "threshold": 1.5,
                "unit": "body-heights/s",
                "direction": "above",
                "held_seconds": 1.4,
                "required_seconds": 1.0,
                "track_id": 7,
                "zone": None,
                "object": None,
            },
        },
        {
            "type": FlagType.UNKNOWN_PERSON,
            "minutes_ago": 16,
            "prefer_role": "ENTRY",
            "trigger": 3.0,
            "evidence": {
                "rule_set": "Face",
                "metric": "Best similarity after voting",
                "value": 0.31,
                "threshold": 0.45,
                "unit": "",
                "direction": "below",
                "held_seconds": None,
                "required_seconds": None,
                "track_id": None,
                "zone": "Door",
                "object": None,
            },
        },
        {
            "type": FlagType.EQUIPMENT_REMOVAL,
            "minutes_ago": 41,
            "prefer_role": "ROOM",
            "trigger": 3.4,
            "evidence": {
                "rule_set": "Object",
                "metric": "Missing since last wrist contact",
                "value": 34.0,
                "threshold": 30.0,
                "unit": "s",
                "direction": "above",
                "held_seconds": 34.0,
                "required_seconds": 30.0,
                "track_id": 3,
                "zone": "Workstation 2",
                "object": "mouse #12",
            },
        },
        {
            "type": FlagType.UNAUTHORIZED_USE,
            "minutes_ago": 73,
            "prefer_role": "ROOM",
            "trigger": 3.8,
            "evidence": {
                "rule_set": "Pose",
                "metric": "Wrists on instructor PC",
                "value": 7.2,
                "threshold": 5.0,
                "unit": "s",
                "direction": "above",
                "held_seconds": 7.2,
                "required_seconds": 5.0,
                "track_id": 11,
                "zone": "Instructor PC",
                "object": None,
            },
        },
        {
            "type": FlagType.RUNNING,
            "minutes_ago": 118,
            "prefer_role": "ROOM",
            "trigger": 2.2,
            "evidence": {
                "rule_set": "Pose",
                "metric": "Hip speed",
                "value": 1.72,
                "threshold": 1.5,
                "unit": "body-heights/s",
                "direction": "above",
                "held_seconds": 1.1,
                "required_seconds": 1.0,
                "track_id": 4,
                "zone": None,
                "object": None,
            },
        },
        {
            "type": FlagType.EQUIPMENT_REMOVAL,
            "minutes_ago": 166,
            "prefer_role": "ROOM",
            "trigger": 4.1,
            "evidence": {
                "rule_set": "Object",
                "metric": "Carried into door zone",
                "value": 1.0,
                "threshold": 1.0,
                "unit": "object",
                "direction": "above",
                "held_seconds": None,
                "required_seconds": None,
                "track_id": 9,
                "zone": "Door",
                "object": "keyboard #4",
            },
            "status": FlagStatus.CONFIRMED,
            "reviewed_by": "Lab administrator",
            "review_note": "Keyboard returned after talking to the student.",
        },
        {
            "type": FlagType.UNAUTHORIZED_USE,
            "minutes_ago": 231,
            "prefer_role": "ROOM",
            "trigger": 3.2,
            "evidence": {
                "rule_set": "Schedule",
                "metric": "Wrists on workstation outside lab hours",
                "value": 12.5,
                "threshold": 10.0,
                "unit": "s",
                "direction": "above",
                "held_seconds": 12.5,
                "required_seconds": 10.0,
                "track_id": 2,
                "zone": "Workstation 1",
                "object": None,
            },
            "status": FlagStatus.CONFIRMED,
            "reviewed_by": "Lab administrator",
            "review_note": "Used a PC after 8 PM without a permit.",
        },
        {
            "type": FlagType.RUNNING,
            "minutes_ago": 302,
            "prefer_role": "ROOM",
            "trigger": 2.9,
            "evidence": {
                "rule_set": "Pose",
                "metric": "Hip speed",
                "value": 1.58,
                "threshold": 1.5,
                "unit": "body-heights/s",
                "direction": "above",
                "held_seconds": 1.0,
                "required_seconds": 1.0,
                "track_id": 5,
                "zone": None,
                "object": None,
            },
            "status": FlagStatus.DISMISSED,
            "reviewed_by": "Lab administrator",
            "review_note": "Walking fast to catch a class; not running.",
        },
    ]

    created: list[BehaviorFlag] = []
    for i, t in enumerate(sample_templates):
        lab = labs[i % len(labs)]
        cam = next((c for c in cameras if c.lab_id == lab.id and c.role == t["prefer_role"]), None)
        if not cam:
            cam = next((c for c in cameras if c.lab_id == lab.id), None)

        occurred = now - dt.timedelta(minutes=t["minutes_ago"])
        status_val = t.get("status", FlagStatus.PENDING)
        reviewed_by = t.get("reviewed_by")
        reviewed_at = occurred + dt.timedelta(minutes=20) if status_val != FlagStatus.PENDING else None

        flag = BehaviorFlag(
            type=t["type"],
            status=status_val,
            occurred_at=occurred,
            lab_id=lab.id,
            camera_id=cam.id if cam else None,
            evidence=t["evidence"],
            snapshot_path=None,
            clip_path=None,
            trigger_offset=t["trigger"],
            responsible_entry_ids=[],
            reviewed_by=reviewed_by,
            reviewed_at=reviewed_at,
            review_note=t.get("review_note"),
        )
        db.add(flag)
        created.append(flag)

    db.commit()
    for f in created:
        db.refresh(f)
    return created


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
        snapshot_path=flag.snapshot_path,
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
    # Check if empty, seed if so
    count = db.execute(select(func.count(BehaviorFlag.id))).scalar_one()
    if count == 0:
        seed_sample_flags(db)

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
    count = db.execute(select(func.count(BehaviorFlag.id))).scalar_one()
    if count == 0:
        seed_sample_flags(db)

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
