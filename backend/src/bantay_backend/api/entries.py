"""Entry logs: search, CSV export, manual recording and recognition testing."""

from __future__ import annotations

import csv
import datetime as dt
import io
from collections.abc import Iterator

import cv2
import numpy as np
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased

from ..config import settings
from ..db import get_db
from ..models import Camera, EntryLog, EntryStatus, Lab, Person
from ..schemas import (
    DetectedFaceRead,
    EntryDecision,
    EntryLogRead,
    EntryPersonRead,
    FaceMatch,
    FacePoseRead,
    ManualEntryCreate,
    Page,
    PoseTrackResult,
    RecognizeResult,
)
from ..services.entry_logging import in_cooldown, record_entry
from ..services.matching import find_closest
from ..services.recognition import get_engine

router = APIRouter(tags=["Entry Logs"])
recognition_router = APIRouter(tags=["Recognition"])


def _row_to_read(entry: EntryLog, person: Person | None, lab_name: str | None, camera_name: str | None) -> EntryLogRead:
    return EntryLogRead(
        id=entry.id,
        entered_at=entry.entered_at,
        status=entry.status,
        similarity=entry.similarity,
        person=(
            EntryPersonRead(
                id=person.id,
                id_number=person.id_number,
                full_name=person.full_name,
                person_type=person.person_type,
            )
            if person
            else None
        ),
        lab_id=entry.lab_id,
        lab_name=lab_name,
        camera_id=entry.camera_id,
        camera_name=camera_name,
        snapshot_path=entry.snapshot_path,
    )


def _filtered_statement(
    q: str | None,
    person_id: int | None,
    lab_id: int | None,
    camera_id: int | None,
    entry_status: str | None,
    date_from: dt.datetime | None,
    date_to: dt.datetime | None,
):
    cam = aliased(Camera)
    stmt = (
        select(EntryLog, Person, Lab.name, cam.name)
        .join(Lab, Lab.id == EntryLog.lab_id)
        .outerjoin(Person, Person.id == EntryLog.person_id)
        .outerjoin(cam, cam.id == EntryLog.camera_id)
    )

    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Person.full_name.ilike(like), Person.id_number.ilike(like))
        )
    if person_id is not None:
        stmt = stmt.where(EntryLog.person_id == person_id)
    if lab_id is not None:
        stmt = stmt.where(EntryLog.lab_id == lab_id)
    if camera_id is not None:
        stmt = stmt.where(EntryLog.camera_id == camera_id)
    if entry_status:
        stmt = stmt.where(EntryLog.status == entry_status)
    if date_from is not None:
        stmt = stmt.where(EntryLog.entered_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(EntryLog.entered_at <= date_to)

    return stmt


@router.get(
    "/entries",
    response_model=Page[EntryLogRead],
    summary="Search entry logs",
    description=(
        "Filter by name or ID number, person, laboratory, camera, status and date "
        "range. Results are newest first and paginated by the server."
    ),
)
def list_entries(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search by person name or ID number."),
    person_id: int | None = Query(None),
    lab_id: int | None = Query(None),
    camera_id: int | None = Query(None),
    entry_status: str | None = Query(
        None, alias="status", pattern="^(MATCHED|UNKNOWN)$"
    ),
    date_from: dt.datetime | None = Query(None, description="Inclusive lower bound (UTC)."),
    date_to: dt.datetime | None = Query(None, description="Inclusive upper bound (UTC)."),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=200),
) -> Page[EntryLogRead]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            422,
            detail="date_from must not be later than date_to.",
        )

    stmt = _filtered_statement(
        q, person_id, lab_id, camera_id, entry_status, date_from, date_to
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(
        stmt.order_by(EntryLog.entered_at.desc(), EntryLog.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()

    return Page[EntryLogRead](
        items=[_row_to_read(e, p, ln, cn) for e, p, ln, cn in rows],
        total=total,
        page=page,
        size=size,
        pages=max(1, -(-total // size)),
    )


@router.get(
    "/entries/export.csv",
    summary="Export the filtered entry logs as CSV",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/csv": {}}, "description": "A CSV file."}},
)
def export_entries(
    db: Session = Depends(get_db),
    q: str | None = Query(None),
    person_id: int | None = Query(None),
    lab_id: int | None = Query(None),
    camera_id: int | None = Query(None),
    entry_status: str | None = Query(None, alias="status", pattern="^(MATCHED|UNKNOWN)$"),
    date_from: dt.datetime | None = Query(None),
    date_to: dt.datetime | None = Query(None),
) -> StreamingResponse:
    stmt = _filtered_statement(
        q, person_id, lab_id, camera_id, entry_status, date_from, date_to
    ).order_by(EntryLog.entered_at.desc())

    def rows() -> Iterator[str]:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "entry_id",
                "entered_at_utc",
                "status",
                "id_number",
                "full_name",
                "person_type",
                "laboratory",
                "camera",
                "similarity",
            ]
        )
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)

        for entry, person, lab_name, camera_name in db.execute(stmt):
            writer.writerow(
                [
                    entry.id,
                    entry.entered_at.isoformat() if entry.entered_at else "",
                    entry.status,
                    person.id_number if person else "",
                    person.full_name if person else "UNKNOWN",
                    person.person_type if person else "",
                    lab_name or "",
                    camera_name or "",
                    f"{entry.similarity:.4f}" if entry.similarity is not None else "",
                ]
            )
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        rows(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="bantay_entries_{stamp}.csv"'},
    )


@router.get("/entries/{entry_id}", response_model=EntryLogRead, summary="Get one entry")
def get_entry(entry_id: int, db: Session = Depends(get_db)) -> EntryLogRead:
    cam = aliased(Camera)
    row = db.execute(
        select(EntryLog, Person, Lab.name, cam.name)
        .join(Lab, Lab.id == EntryLog.lab_id)
        .outerjoin(Person, Person.id == EntryLog.person_id)
        .outerjoin(cam, cam.id == EntryLog.camera_id)
        .where(EntryLog.id == entry_id)
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Entry not found.")
    entry, person, lab_name, camera_name = row
    return _row_to_read(entry, person, lab_name, camera_name)


@router.post(
    "/entries",
    response_model=EntryDecision,
    status_code=status.HTTP_201_CREATED,
    summary="Record an entry manually",
    description=(
        "Writes an entry without a camera. Useful for testing the rules and as a "
        "fallback when a camera is down. The cooldown still applies unless "
        "bypass_cooldown is set."
    ),
)
def create_entry(payload: ManualEntryCreate, db: Session = Depends(get_db)) -> EntryDecision:
    lab = db.get(Lab, payload.lab_id)
    if lab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    person = None
    if payload.person_id is not None:
        person = db.get(Person, payload.person_id)
        if person is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Person not found.")

    if payload.camera_id is not None and db.get(Camera, payload.camera_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    now = payload.entered_at or dt.datetime.now(dt.UTC)

    if (
        person is not None
        and not payload.bypass_cooldown
        and in_cooldown(db, person.id, lab.id, lab.cooldown_seconds, now=now)
    ):
        return EntryDecision(
            logged=False,
            reason="cooldown",
            matched_person_id=person.id,
            similarity=payload.similarity,
        )

    entry = EntryLog(
        person_id=person.id if person else None,
        lab_id=lab.id,
        camera_id=payload.camera_id,
        entered_at=now,
        similarity=payload.similarity,
        status=EntryStatus.MATCHED if person else EntryStatus.UNKNOWN,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    camera = db.get(Camera, entry.camera_id) if entry.camera_id else None
    return EntryDecision(
        logged=True,
        reason="logged",
        entry=_row_to_read(entry, person, lab.name, camera.name if camera else None),
        similarity=payload.similarity,
        matched_person_id=person.id if person else None,
    )


@router.delete(
    "/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an entry log",
)
def delete_entry(entry_id: int, db: Session = Depends(get_db)) -> None:
    entry = db.get(EntryLog, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Entry not found.")
    db.delete(entry)
    db.commit()


# --------------------------------------------------------------------------
# Recognition testing
# --------------------------------------------------------------------------
@recognition_router.post(
    "/recognize",
    response_model=RecognizeResult,
    summary="Recognize faces in an uploaded image (does not log anything)",
    description=(
        "Runs detection and matching on one image and reports the closest enrolled "
        "person for each face. Nothing is written to the entry log. Use this to "
        "check accuracy and to choose the match threshold."
    ),
)
async def recognize(
    file: UploadFile = File(..., description="An image containing zero or more faces."),
    threshold: float | None = Query(
        None, ge=0.0, le=1.0, description="Defaults to the system threshold."
    ),
    db: Session = Depends(get_db),
) -> RecognizeResult:
    engine = get_engine()
    if not engine.is_ready():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The recognition engine is not available.",
        )

    raw = await file.read()
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Not a readable image file."
        )

    used = threshold if threshold is not None else settings.default_match_threshold
    faces = engine.detect(image)

    out: list[DetectedFaceRead] = []
    for face in faces:
        match = find_closest(db, face.embedding)
        out.append(
            DetectedFaceRead(
                bbox=list(face.bbox),
                det_score=face.det_score,
                match=(
                    FaceMatch(
                        person_id=match.person_id,
                        id_number=match.id_number,
                        full_name=match.full_name,
                        similarity=match.similarity,
                    )
                    if match
                    else None
                ),
                accepted=bool(match and match.similarity >= used),
            )
        )

    return RecognizeResult(engine=engine.name, threshold=used, faces=out)


@recognition_router.post(
    "/recognize/pose",
    response_model=PoseTrackResult,
    summary="Estimate live 3D head pose for guided face enrollment",
    description=(
        "Runs lightweight face detection and 68-point 3D landmark head-pose "
        "estimation without computing ArcFace embeddings or writing logs."
    ),
)
async def recognize_pose(
    file: UploadFile = File(..., description="A downscaled webcam frame."),
) -> PoseTrackResult:
    engine = get_engine()
    if not engine.is_ready():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The recognition engine is not available.",
        )

    raw = await file.read()
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Not a readable image file."
        )

    pose = engine.detect_pose(image)
    if pose is None:
        return PoseTrackResult(engine=engine.name, detected=False, pose=None)

    return PoseTrackResult(
        engine=engine.name,
        detected=True,
        pose=FacePoseRead(
            yaw_deg=pose.yaw_deg,
            pitch_deg=pose.pitch_deg,
            roll_deg=pose.roll_deg,
            nose_x_ratio=pose.nose_x_ratio,
            nose_y_ratio=pose.nose_y_ratio,
            center_x=pose.center_x,
            center_y=pose.center_y,
            size=pose.size,
            det_score=pose.det_score,
        ),
    )


@recognition_router.post(
    "/recognize/log",
    response_model=EntryDecision,
    summary="Recognize an uploaded image and apply the entry rules",
    description=(
        "The same path a camera frame takes: detect the largest face, match it, "
        "apply the threshold and cooldown, and write an entry when allowed."
    ),
)
async def recognize_and_log(
    lab_id: int = Query(..., description="Laboratory the entry belongs to."),
    camera_id: int | None = Query(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> EntryDecision:
    lab = db.get(Lab, lab_id)
    if lab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    camera = db.get(Camera, camera_id) if camera_id else None
    if camera_id is not None and camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    engine = get_engine()
    if not engine.is_ready():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The recognition engine is not available.",
        )

    raw = await file.read()
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Not a readable image file."
        )

    faces = engine.detect(image)
    if not faces:
        return EntryDecision(logged=False, reason="no_faces")

    # The face closest to the camera is the one walking through the door.
    face = max(faces, key=lambda f: f.area)
    outcome = record_entry(
        db, lab=lab, camera=camera, embedding=face.embedding, frame=image
    )
    db.commit()

    entry_read = None
    if outcome.entry is not None:
        db.refresh(outcome.entry)
        person = (
            db.get(Person, outcome.entry.person_id) if outcome.entry.person_id else None
        )
        entry_read = _row_to_read(
            outcome.entry, person, lab.name, camera.name if camera else None
        )

    return EntryDecision(
        logged=outcome.logged,
        reason=outcome.reason,
        entry=entry_read,
        similarity=outcome.similarity,
        matched_person_id=outcome.matched_person_id,
    )
