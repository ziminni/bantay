"""SQLAlchemy models for Bantay.

Five entities, matching the project specification: persons, face embeddings,
laboratories, cameras and entry logs. Bantay records entries only; there is no
exit, duration or attendance concept anywhere in this schema.
"""

from __future__ import annotations

import datetime as dt
from enum import StrEnum

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import settings
from .db import Base


class PersonType(StrEnum):
    STUDENT = "STUDENT"
    FACULTY = "FACULTY"
    STAFF = "STAFF"


class CameraRole(StrEnum):
    ENTRY = "ENTRY"
    ROOM = "ROOM"


class CameraStatus(StrEnum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    DISABLED = "DISABLED"


class EntryStatus(StrEnum):
    MATCHED = "MATCHED"
    UNKNOWN = "UNKNOWN"


class FlagType(StrEnum):
    RUNNING = "RUNNING"
    EQUIPMENT_REMOVAL = "EQUIPMENT_REMOVAL"
    UNAUTHORIZED_USE = "UNAUTHORIZED_USE"
    UNKNOWN_PERSON = "UNKNOWN_PERSON"


class FlagStatus(StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    DISMISSED = "DISMISSED"


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


class Person(Base):
    """A student, faculty member or staff member enrolled in Bantay."""

    __tablename__ = "person"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160), index=True)
    person_type: Mapped[str] = mapped_column(String(16), default=PersonType.STUDENT)
    department: Mapped[str | None] = mapped_column(String(120), default=None)

    # Consent is a precondition of enrollment under RA 10173.
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_signed_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=_utcnow
    )

    embeddings: Mapped[list["FaceEmbedding"]] = relationship(
        back_populates="person",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    entries: Mapped[list["EntryLog"]] = relationship(back_populates="person")

    __table_args__ = (
        CheckConstraint(
            "person_type IN ('STUDENT','FACULTY','STAFF')",
            name="ck_person_type",
        ),
    )


class FaceEmbedding(Base):
    """One ArcFace embedding, produced from one accepted enrollment photo.

    The photo itself is never stored: it is turned into an embedding in memory
    and discarded.
    """

    __tablename__ = "face_embedding"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(
        ForeignKey("person.id", ondelete="CASCADE"), index=True
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dim))
    det_score: Mapped[float | None] = mapped_column(Float, default=None)
    source_filename: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    person: Mapped[Person] = relationship(back_populates="embeddings")

    __table_args__ = (
        # Approximate nearest-neighbour index for cosine distance, so that the
        # closest enrolled face is found without scanning the table.
        Index(
            "ix_face_embedding_vector",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class Lab(Base):
    """A computer laboratory. Threshold and cooldown are tuned per laboratory."""

    __tablename__ = "lab"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    room: Mapped[str | None] = mapped_column(String(80), default=None)
    open_time: Mapped[dt.time | None] = mapped_column(Time, default=None)
    close_time: Mapped[dt.time | None] = mapped_column(Time, default=None)
    match_threshold: Mapped[float] = mapped_column(
        Float, default=settings.default_match_threshold
    )
    cooldown_seconds: Mapped[int] = mapped_column(
        Integer, default=settings.default_cooldown_seconds
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    cameras: Mapped[list["Camera"]] = relationship(
        back_populates="lab", cascade="all, delete-orphan", passive_deletes=True
    )
    entries: Mapped[list["EntryLog"]] = relationship(back_populates="lab")
    flags: Mapped[list["BehaviorFlag"]] = relationship(
        back_populates="lab", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        CheckConstraint(
            "match_threshold >= 0 AND match_threshold <= 1",
            name="ck_lab_threshold_range",
        ),
        CheckConstraint("cooldown_seconds >= 0", name="ck_lab_cooldown_nonneg"),
    )


class Camera(Base):
    """An IP/CCTV camera read over RTSP."""

    __tablename__ = "camera"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lab_id: Mapped[int] = mapped_column(
        ForeignKey("lab.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(16), default=CameraRole.ENTRY)
    rtsp_url: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default=CameraStatus.OFFLINE)
    last_seen_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    last_error: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lab: Mapped[Lab] = relationship(back_populates="cameras")

    __table_args__ = (
        CheckConstraint("role IN ('ENTRY','ROOM')", name="ck_camera_role"),
        CheckConstraint(
            "status IN ('ONLINE','OFFLINE','DISABLED')", name="ck_camera_status"
        ),
        Index("ix_camera_lab_name", "lab_id", "name", unique=True),
    )


class EntryLog(Base):
    """One recorded entry into a laboratory.

    ``person_id`` is null when the face did not match any enrolled person; the
    row is then stored with status UNKNOWN.
    """

    __tablename__ = "entry_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int | None] = mapped_column(
        ForeignKey("person.id", ondelete="SET NULL"), default=None, index=True
    )
    lab_id: Mapped[int] = mapped_column(
        ForeignKey("lab.id", ondelete="RESTRICT"), index=True
    )
    camera_id: Mapped[int | None] = mapped_column(
        ForeignKey("camera.id", ondelete="SET NULL"), default=None, index=True
    )
    entered_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
    similarity: Mapped[float | None] = mapped_column(Float, default=None)
    status: Mapped[str] = mapped_column(String(16), default=EntryStatus.MATCHED)
    snapshot_path: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    person: Mapped[Person | None] = relationship(back_populates="entries")
    lab: Mapped[Lab] = relationship(back_populates="entries")
    camera: Mapped[Camera | None] = relationship()

    __table_args__ = (
        CheckConstraint("status IN ('MATCHED','UNKNOWN')", name="ck_entry_status"),
        Index("ix_entry_log_lab_entered", "lab_id", "entered_at"),
        Index("ix_entry_log_person_entered", "person_id", "entered_at"),
    )


class BehaviorFlag(Base):
    """An incident or suspicious activity flagged for review.

    Flag types: RUNNING, EQUIPMENT_REMOVAL, UNAUTHORIZED_USE, UNKNOWN_PERSON.
    Status lifecycle: PENDING -> CONFIRMED | DISMISSED (can reopen back to PENDING).
    """

    __tablename__ = "behavior_flag"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(
        String(16), default=FlagStatus.PENDING, index=True
    )
    occurred_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
    lab_id: Mapped[int] = mapped_column(
        ForeignKey("lab.id", ondelete="CASCADE"), index=True
    )
    camera_id: Mapped[int | None] = mapped_column(
        ForeignKey("camera.id", ondelete="SET NULL"), default=None, index=True
    )
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    snapshot_path: Mapped[str | None] = mapped_column(String(255), default=None)
    clip_path: Mapped[str | None] = mapped_column(String(255), default=None)
    trigger_offset: Mapped[float] = mapped_column(Float, default=3.0)
    responsible_entry_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    reviewed_by: Mapped[str | None] = mapped_column(String(100), default=None)
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    review_note: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lab: Mapped[Lab] = relationship(back_populates="flags")
    camera: Mapped[Camera | None] = relationship()

    __table_args__ = (
        CheckConstraint(
            "type IN ('RUNNING','EQUIPMENT_REMOVAL','UNAUTHORIZED_USE','UNKNOWN_PERSON')",
            name="ck_behavior_flag_type",
        ),
        CheckConstraint(
            "status IN ('PENDING','CONFIRMED','DISMISSED')",
            name="ck_behavior_flag_status",
        ),
        Index("ix_behavior_flag_lab_occurred", "lab_id", "occurred_at"),
    )
