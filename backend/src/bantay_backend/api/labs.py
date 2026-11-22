"""Laboratory management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Camera, EntryLog, Lab
from ..schemas import LabCreate, LabRead, LabUpdate

router = APIRouter(prefix="/labs", tags=["Laboratories"])


def _to_read(lab: Lab, camera_count: int) -> LabRead:
    return LabRead(
        id=lab.id,
        name=lab.name,
        room=lab.room,
        open_time=lab.open_time,
        close_time=lab.close_time,
        match_threshold=lab.match_threshold,
        cooldown_seconds=lab.cooldown_seconds,
        active=lab.active,
        created_at=lab.created_at,
        camera_count=camera_count,
    )


def _camera_counts(db: Session, lab_ids: list[int]) -> dict[int, int]:
    if not lab_ids:
        return {}
    rows = db.execute(
        select(Camera.lab_id, func.count(Camera.id))
        .where(Camera.lab_id.in_(lab_ids))
        .group_by(Camera.lab_id)
    ).all()
    return {lid: int(n) for lid, n in rows}


@router.get("", response_model=list[LabRead], summary="List laboratories")
def list_labs(
    db: Session = Depends(get_db),
    active: bool | None = Query(None),
) -> list[LabRead]:
    stmt = select(Lab).order_by(Lab.name)
    if active is not None:
        stmt = stmt.where(Lab.active.is_(active))
    labs = db.execute(stmt).scalars().all()
    counts = _camera_counts(db, [lb.id for lb in labs])
    return [_to_read(lb, counts.get(lb.id, 0)) for lb in labs]


@router.post(
    "",
    response_model=LabRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a laboratory",
    description="Threshold and cooldown fall back to the system defaults when omitted.",
)
def create_lab(payload: LabCreate, db: Session = Depends(get_db)) -> LabRead:
    lab = Lab(
        name=payload.name,
        room=payload.room,
        open_time=payload.open_time,
        close_time=payload.close_time,
        match_threshold=(
            payload.match_threshold
            if payload.match_threshold is not None
            else settings.default_match_threshold
        ),
        cooldown_seconds=(
            payload.cooldown_seconds
            if payload.cooldown_seconds is not None
            else settings.default_cooldown_seconds
        ),
    )
    db.add(lab)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"A laboratory named '{payload.name}' already exists.",
        ) from None
    db.refresh(lab)
    return _to_read(lab, 0)


@router.get("/{lab_id}", response_model=LabRead, summary="Get one laboratory")
def get_lab(lab_id: int, db: Session = Depends(get_db)) -> LabRead:
    lab = db.get(Lab, lab_id)
    if lab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")
    return _to_read(lab, _camera_counts(db, [lab.id]).get(lab.id, 0))


@router.patch("/{lab_id}", response_model=LabRead, summary="Update a laboratory")
def update_lab(
    lab_id: int, payload: LabUpdate, db: Session = Depends(get_db)
) -> LabRead:
    lab = db.get(Lab, lab_id)
    if lab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(lab, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="That laboratory name is already taken."
        ) from None
    db.refresh(lab)
    return _to_read(lab, _camera_counts(db, [lab.id]).get(lab.id, 0))


@router.delete(
    "/{lab_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a laboratory",
    description="Refused when entry logs reference it; deactivate it instead.",
)
def delete_lab(lab_id: int, db: Session = Depends(get_db)) -> None:
    lab = db.get(Lab, lab_id)
    if lab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    used = db.execute(
        select(EntryLog.id).where(EntryLog.lab_id == lab_id).limit(1)
    ).first()
    if used:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "This laboratory has entry logs and cannot be deleted. "
                "Set active=false instead."
            ),
        )

    db.delete(lab)
    db.commit()
