"""Dashboard statistics and the health endpoint."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from .. import __version__
from ..config import settings
from ..db import check_database, get_db
from ..models import Camera, CameraStatus, EntryLog, EntryStatus, Lab, Person
from ..schemas import (
    CameraHealth,
    EntryLogRead,
    EntryPersonRead,
    HealthResponse,
    HourBucket,
    LabTotal,
    TodayStats,
)
from ..services.camera_worker import manager
from ..services.recognition import get_engine

router = APIRouter(tags=["Dashboard"])
system_router = APIRouter(tags=["System"])


@router.get(
    "/stats/today",
    response_model=TodayStats,
    summary="Today's statistics for the dashboard",
    description=(
        "Counters, entries per hour, per-laboratory totals and the latest entries. "
        "The dashboard polls this endpoint every few seconds."
    ),
)
def stats_today(
    db: Session = Depends(get_db),
    lab_id: int | None = Query(None, description="Restrict the figures to one laboratory."),
    latest: int = Query(10, ge=0, le=50, description="How many recent entries to include."),
) -> TodayStats:
    now = dt.datetime.now(dt.UTC)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    base = select(EntryLog).where(EntryLog.entered_at >= start)
    if lab_id is not None:
        base = base.where(EntryLog.lab_id == lab_id)
    sub = base.subquery()

    entries_today = db.scalar(select(func.count()).select_from(sub)) or 0
    distinct_persons = (
        db.scalar(
            select(func.count(func.distinct(sub.c.person_id))).where(
                sub.c.person_id.is_not(None)
            )
        )
        or 0
    )
    unknown_today = (
        db.scalar(
            select(func.count()).select_from(sub).where(sub.c.status == EntryStatus.UNKNOWN)
        )
        or 0
    )

    hour_rows = db.execute(
        select(func.extract("hour", sub.c.entered_at).label("h"), func.count())
        .group_by("h")
        .order_by("h")
    ).all()
    counts_by_hour = {int(h): int(n) for h, n in hour_rows}
    entries_per_hour = [
        HourBucket(hour=h, count=counts_by_hour.get(h, 0)) for h in range(24)
    ]

    per_lab_rows = db.execute(
        select(Lab.id, Lab.name, func.count(sub.c.id))
        .outerjoin(sub, sub.c.lab_id == Lab.id)
        .group_by(Lab.id, Lab.name)
        .order_by(Lab.name)
    ).all()
    per_lab = [
        LabTotal(lab_id=lid, lab_name=lname, count=int(n)) for lid, lname, n in per_lab_rows
    ]

    cam_stmt = select(Camera)
    if lab_id is not None:
        cam_stmt = cam_stmt.where(Camera.lab_id == lab_id)
    cameras = db.execute(cam_stmt).scalars().all()
    running = manager.running_ids
    cameras_online = sum(1 for c in cameras if c.id in running and c.status == CameraStatus.ONLINE)

    latest_entries: list[EntryLogRead] = []
    if latest:
        cam = aliased(Camera)
        rows = db.execute(
            select(EntryLog, Person, Lab.name, cam.name)
            .join(Lab, Lab.id == EntryLog.lab_id)
            .outerjoin(Person, Person.id == EntryLog.person_id)
            .outerjoin(cam, cam.id == EntryLog.camera_id)
            .where(EntryLog.entered_at >= start)
            .where(EntryLog.lab_id == lab_id if lab_id is not None else True)
            .order_by(EntryLog.entered_at.desc())
            .limit(latest)
        ).all()
        latest_entries = [
            EntryLogRead(
                id=e.id,
                entered_at=e.entered_at,
                status=e.status,
                similarity=e.similarity,
                person=(
                    EntryPersonRead(
                        id=p.id,
                        id_number=p.id_number,
                        full_name=p.full_name,
                        person_type=p.person_type,
                    )
                    if p
                    else None
                ),
                lab_id=e.lab_id,
                lab_name=ln,
                camera_id=e.camera_id,
                camera_name=cn,
                snapshot_path=e.snapshot_path,
            )
            for e, p, ln, cn in rows
        ]

    return TodayStats(
        date=now.date(),
        entries_today=int(entries_today),
        distinct_persons_today=int(distinct_persons),
        unknown_today=int(unknown_today),
        cameras_online=cameras_online,
        cameras_total=len(cameras),
        entries_per_hour=entries_per_hour,
        per_lab=per_lab,
        latest_entries=latest_entries,
    )


@system_router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health",
    description="Database reachability, recognition engine state and camera status. No personal data.",
)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    db_ok = check_database()
    engine = get_engine()

    cameras: list[CameraHealth] = []
    online = offline = 0

    if db_ok:
        rows = db.execute(
            select(Camera, Lab.name).join(Lab, Lab.id == Camera.lab_id).order_by(Camera.id)
        ).all()
        running = manager.running_ids
        for camera, lab_name in rows:
            is_online = camera.status == CameraStatus.ONLINE and camera.id in running
            online += int(is_online)
            offline += int(not is_online)
            cameras.append(
                CameraHealth(
                    id=camera.id,
                    name=camera.name,
                    lab_name=lab_name,
                    role=camera.role,
                    status=camera.status,
                    worker_running=camera.id in running,
                    last_seen_at=camera.last_seen_at,
                    last_error=camera.last_error,
                )
            )

    return HealthResponse(
        status="ok" if db_ok else "degraded",
        app=settings.app_name,
        version=__version__,
        environment=settings.environment,
        database_reachable=db_ok,
        recognition_engine=engine.name,
        recognition_ready=engine.is_ready(),
        embedding_dim=settings.embedding_dim,
        cameras_online=online,
        cameras_offline=offline,
        cameras=cameras,
    )
