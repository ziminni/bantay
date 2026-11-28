"""Enrollment and person management."""

from __future__ import annotations

import datetime as dt

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import FaceEmbedding, Person
from ..schemas import (
    EnrollmentResult,
    FaceEmbeddingRead,
    Page,
    PersonCreate,
    PersonRead,
    PersonUpdate,
    RejectedPhoto,
)
from ..services.recognition import get_engine

router = APIRouter(prefix="/persons", tags=["Persons & Enrollment"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _to_read(person: Person, embedding_count: int) -> PersonRead:
    return PersonRead(
        id=person.id,
        id_number=person.id_number,
        full_name=person.full_name,
        person_type=person.person_type,
        department=person.department,
        consent_given=person.consent_given,
        consent_signed_at=person.consent_signed_at,
        active=person.active,
        created_at=person.created_at,
        embedding_count=embedding_count,
    )


def _counts(db: Session, person_ids: list[int]) -> dict[int, int]:
    if not person_ids:
        return {}
    rows = db.execute(
        select(FaceEmbedding.person_id, func.count(FaceEmbedding.id))
        .where(FaceEmbedding.person_id.in_(person_ids))
        .group_by(FaceEmbedding.person_id)
    ).all()
    return {pid: int(n) for pid, n in rows}


@router.get(
    "",
    response_model=Page[PersonRead],
    summary="List and search persons",
)
def list_persons(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Search by name or ID number."),
    person_type: str | None = Query(None, pattern="^(STUDENT|FACULTY|STAFF)$"),
    active: bool | None = Query(None),
    enrolled_only: bool = Query(
        False, description="Return only persons that have at least one face embedding."
    ),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=200),
) -> Page[PersonRead]:
    stmt = select(Person)

    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Person.full_name.ilike(like), Person.id_number.ilike(like))
        )
    if person_type:
        stmt = stmt.where(Person.person_type == person_type)
    if active is not None:
        stmt = stmt.where(Person.active.is_(active))
    if enrolled_only:
        stmt = stmt.where(
            select(FaceEmbedding.id)
            .where(FaceEmbedding.person_id == Person.id)
            .exists()
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        db.execute(
            stmt.order_by(Person.full_name).offset((page - 1) * size).limit(size)
        )
        .scalars()
        .all()
    )
    counts = _counts(db, [p.id for p in rows])

    return Page[PersonRead](
        items=[_to_read(p, counts.get(p.id, 0)) for p in rows],
        total=total,
        page=page,
        size=size,
        pages=max(1, -(-total // size)),
    )


@router.post(
    "",
    response_model=PersonRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a person",
    description="Creates the record only. Face photos are uploaded separately and require consent.",
)
def create_person(payload: PersonCreate, db: Session = Depends(get_db)) -> PersonRead:
    exists = db.execute(
        select(Person.id).where(Person.id_number == payload.id_number)
    ).first()
    if exists:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"A person with ID number {payload.id_number} is already enrolled.",
        )

    person = Person(
        id_number=payload.id_number,
        full_name=payload.full_name,
        person_type=payload.person_type,
        department=payload.department,
        consent_given=payload.consent_given,
        consent_signed_at=payload.consent_signed_at
        or (dt.datetime.now(dt.UTC) if payload.consent_given else None),
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return _to_read(person, 0)


@router.get("/{person_id}", response_model=PersonRead, summary="Get one person")
def get_person(person_id: int, db: Session = Depends(get_db)) -> PersonRead:
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Person not found.")
    return _to_read(person, _counts(db, [person.id]).get(person.id, 0))


@router.patch("/{person_id}", response_model=PersonRead, summary="Update a person")
def update_person(
    person_id: int, payload: PersonUpdate, db: Session = Depends(get_db)
) -> PersonRead:
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Person not found.")

    data = payload.model_dump(exclude_unset=True)
    if data.get("consent_given") and person.consent_signed_at is None:
        data.setdefault("consent_signed_at", dt.datetime.now(dt.UTC))

    for key, value in data.items():
        setattr(person, key, value)

    db.commit()
    db.refresh(person)
    return _to_read(person, _counts(db, [person.id]).get(person.id, 0))


@router.delete(
    "/{person_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Withdraw a person (erases their face data)",
    description=(
        "Deletes every face embedding of the person. Past entry logs are kept but "
        "their person reference is cleared, which satisfies the right to erasure "
        "under RA 10173 without destroying the laboratory's records."
    ),
)
def delete_person(person_id: int, db: Session = Depends(get_db)) -> None:
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Person not found.")
    db.delete(person)
    db.commit()


# --------------------------------------------------------------------------
# Face enrollment
# --------------------------------------------------------------------------
@router.get(
    "/{person_id}/faces",
    response_model=list[FaceEmbeddingRead],
    summary="List a person's face embeddings",
)
def list_faces(person_id: int, db: Session = Depends(get_db)) -> list[FaceEmbeddingRead]:
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Person not found.")
    rows = (
        db.execute(
            select(FaceEmbedding)
            .where(FaceEmbedding.person_id == person_id)
            .order_by(FaceEmbedding.created_at)
        )
        .scalars()
        .all()
    )
    return [FaceEmbeddingRead.model_validate(r) for r in rows]


@router.post(
    "/{person_id}/faces",
    response_model=EnrollmentResult,
    summary="Upload face photos and store their embeddings",
    description=(
        "Accepts 1 to 12 images. Each photo must contain exactly one face of "
        "acceptable quality. Photos are converted to embeddings in memory and "
        "discarded: no image file is ever written to disk."
    ),
)
async def enroll_faces(
    person_id: int,
    files: list[UploadFile] = File(..., description="Face photos (JPEG or PNG)."),
    db: Session = Depends(get_db),
) -> EnrollmentResult:
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Person not found.")

    if not person.consent_given:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=(
                "Consent has not been recorded for this person. Enrollment is "
                "consent-gated under RA 10173."
            ),
        )

    if len(files) > settings.max_enrollment_photos:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"At most {settings.max_enrollment_photos} photos per upload.",
        )

    engine = get_engine()
    if not engine.is_ready():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The recognition engine is not available, so embeddings cannot be "
                "computed. Install the AI stack and set RECOGNITION_ENGINE=insightface."
            ),
        )

    accepted: list[FaceEmbeddingRead] = []
    rejected: list[RejectedPhoto] = []

    for upload in files:
        filename = upload.filename or "photo"
        raw = await upload.read()

        if not raw:
            rejected.append(RejectedPhoto(filename=filename, reason="The file is empty."))
            continue
        if len(raw) > MAX_UPLOAD_BYTES:
            rejected.append(
                RejectedPhoto(filename=filename, reason="The file is larger than 10 MB.")
            )
            continue

        image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        del raw  # the photo stops existing here
        if image is None:
            rejected.append(
                RejectedPhoto(filename=filename, reason="Not a readable image file.")
            )
            continue

        try:
            faces = engine.detect(image)
        except Exception as exc:
            rejected.append(
                RejectedPhoto(filename=filename, reason=f"Detection failed: {exc}")
            )
            continue

        if len(faces) == 0:
            rejected.append(
                RejectedPhoto(filename=filename, reason="No face was found in the photo.")
            )
            continue
        if len(faces) > 1:
            rejected.append(
                RejectedPhoto(
                    filename=filename,
                    reason=f"{len(faces)} faces were found; the photo must contain exactly one.",
                )
            )
            continue

        face = faces[0]
        if face.det_score < settings.min_enrollment_det_score:
            rejected.append(
                RejectedPhoto(
                    filename=filename,
                    reason=(
                        f"Face quality is too low (score {face.det_score:.2f}, "
                        f"minimum {settings.min_enrollment_det_score:.2f})."
                    ),
                )
            )
            continue

        row = FaceEmbedding(
            person_id=person.id,
            embedding=face.embedding.tolist(),
            det_score=float(face.det_score),
            source_filename=filename,
        )
        db.add(row)
        db.flush()
        accepted.append(FaceEmbeddingRead.model_validate(row))

    db.commit()

    total = db.scalar(
        select(func.count(FaceEmbedding.id)).where(FaceEmbedding.person_id == person.id)
    ) or 0

    return EnrollmentResult(
        person_id=person.id,
        accepted=accepted,
        rejected=rejected,
        total_embeddings=int(total),
        meets_minimum=int(total) >= settings.min_enrollment_photos,
    )


@router.delete(
    "/{person_id}/faces/{embedding_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete one face embedding",
)
def delete_face(
    person_id: int, embedding_id: int, db: Session = Depends(get_db)
) -> None:
    row = db.get(FaceEmbedding, embedding_id)
    if row is None or row.person_id != person_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Embedding not found.")
    db.delete(row)
    db.commit()
