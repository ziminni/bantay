"""Pydantic request and response models.

These double as the Swagger documentation, so each field carries a description
and the examples shown in the UI are realistic.
"""

from __future__ import annotations

import datetime as dt
import re
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")

PersonTypeLiteral = Literal["STUDENT", "FACULTY", "STAFF"]
CameraRoleLiteral = Literal["ENTRY", "ROOM"]
CameraStatusLiteral = Literal["ONLINE", "OFFLINE", "DISABLED"]
EntryStatusLiteral = Literal["MATCHED", "UNKNOWN"]

_RTSP_CREDENTIALS = re.compile(r"://([^:/@]+):([^@]+)@")


def mask_rtsp_url(url: str | None) -> str | None:
    """Replace the password in an RTSP URL with asterisks.

    Camera passwords are never returned to the browser.
    """
    if not url:
        return url
    return _RTSP_CREDENTIALS.sub(lambda m: f"://{m.group(1)}:****@", url)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------
# Pagination
# --------------------------------------------------------------------------
class Page(BaseModel, Generic[T]):
    """A page of results together with the paging information."""

    items: list[T]
    total: int = Field(description="Total number of rows matching the filters.")
    page: int = Field(description="1-based page number.")
    size: int = Field(description="Number of rows per page.")
    pages: int = Field(description="Total number of pages.")


# --------------------------------------------------------------------------
# Person
# --------------------------------------------------------------------------
class PersonBase(BaseModel):
    id_number: Annotated[str, Field(min_length=1, max_length=32, examples=["2021-12345"])]
    full_name: Annotated[str, Field(min_length=1, max_length=160, examples=["Juan Dela Cruz"])]
    person_type: PersonTypeLiteral = "STUDENT"
    department: Annotated[str | None, Field(max_length=120, examples=["Information Technology"])] = None

    @field_validator("id_number", "full_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class PersonCreate(PersonBase):
    consent_given: bool = Field(
        default=False,
        description=(
            "Must be true before any face photo can be uploaded. Enrollment is "
            "consent-gated under the Data Privacy Act of 2012 (RA 10173)."
        ),
    )
    consent_signed_at: dt.datetime | None = None


class PersonUpdate(BaseModel):
    full_name: Annotated[str | None, Field(min_length=1, max_length=160)] = None
    person_type: PersonTypeLiteral | None = None
    department: Annotated[str | None, Field(max_length=120)] = None
    consent_given: bool | None = None
    consent_signed_at: dt.datetime | None = None
    active: bool | None = None


class PersonRead(ORMModel, PersonBase):
    id: int
    consent_given: bool
    consent_signed_at: dt.datetime | None
    active: bool
    created_at: dt.datetime
    embedding_count: int = Field(
        default=0, description="Number of enrolled face embeddings for this person."
    )


# --------------------------------------------------------------------------
# Face embedding / enrollment
# --------------------------------------------------------------------------
class FaceEmbeddingRead(ORMModel):
    id: int
    person_id: int
    det_score: float | None
    source_filename: str | None
    created_at: dt.datetime


class RejectedPhoto(BaseModel):
    filename: str
    reason: str = Field(
        description="Why the photo was rejected: no face, several faces, or low quality."
    )


class EnrollmentResult(BaseModel):
    """Outcome of uploading face photos for a person."""

    person_id: int
    accepted: list[FaceEmbeddingRead]
    rejected: list[RejectedPhoto]
    total_embeddings: int = Field(
        description="Embeddings this person has in total after the upload."
    )
    meets_minimum: bool = Field(
        description="True when the person has at least the required number of embeddings."
    )
    note: str = "Uploaded photos were converted to embeddings and discarded; no image was stored."


# --------------------------------------------------------------------------
# Lab
# --------------------------------------------------------------------------
class LabBase(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=80, examples=["Lab 1"])]
    room: Annotated[str | None, Field(max_length=80, examples=["IT Building 201"])] = None
    open_time: dt.time | None = Field(default=None, examples=["07:00:00"])
    close_time: dt.time | None = Field(default=None, examples=["19:00:00"])
    match_threshold: Annotated[
        float | None,
        Field(
            ge=0.0,
            le=1.0,
            description="Cosine similarity at or above which a face is accepted here.",
            examples=[0.45],
        ),
    ] = None
    cooldown_seconds: Annotated[
        int | None,
        Field(
            ge=0,
            description="Seconds during which the same person is not logged again in this lab.",
            examples=[120],
        ),
    ] = None


class LabCreate(LabBase):
    pass


class LabUpdate(BaseModel):
    name: Annotated[str | None, Field(min_length=1, max_length=80)] = None
    room: Annotated[str | None, Field(max_length=80)] = None
    open_time: dt.time | None = None
    close_time: dt.time | None = None
    match_threshold: Annotated[float | None, Field(ge=0.0, le=1.0)] = None
    cooldown_seconds: Annotated[int | None, Field(ge=0)] = None
    active: bool | None = None


class LabRead(ORMModel):
    id: int
    name: str
    room: str | None
    open_time: dt.time | None
    close_time: dt.time | None
    match_threshold: float
    cooldown_seconds: int
    active: bool
    created_at: dt.datetime
    camera_count: int = 0


# --------------------------------------------------------------------------
# Camera
# --------------------------------------------------------------------------
class CameraBase(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=80, examples=["Lab 1 Entrance"])]
    role: CameraRoleLiteral = Field(
        default="ENTRY",
        description="ENTRY cameras feed recognition and entry logging; ROOM cameras are live view only.",
    )
    rtsp_url: Annotated[
        str,
        Field(
            min_length=1,
            examples=["rtsp://admin:password@192.168.1.50:554/Streaming/Channels/101"],
            description="Full RTSP URL or local device identifier (e.g. webcam://0).",
        ),
    ]
    enabled: bool = True

    @field_validator("rtsp_url", mode="before")
    @classmethod
    def _clean_url(cls, v: str | None) -> str | None:
        if not v:
            return v
        s = str(v).strip()
        if s.startswith("rtsp://http://"):
            return s[len("rtsp://"):]
        if s.startswith("rtsp://https://"):
            return s[len("rtsp://"):]
        return s


class CameraCreate(CameraBase):
    lab_id: int


class CameraUpdate(BaseModel):
    name: Annotated[str | None, Field(min_length=1, max_length=80)] = None
    role: CameraRoleLiteral | None = None
    rtsp_url: Annotated[str | None, Field(min_length=1)] = None
    enabled: bool | None = None
    lab_id: int | None = None

    @field_validator("rtsp_url", mode="before")
    @classmethod
    def _clean_url(cls, v: str | None) -> str | None:
        if not v:
            return v
        s = str(v).strip()
        if s.startswith("rtsp://http://"):
            return s[len("rtsp://"):]
        if s.startswith("rtsp://https://"):
            return s[len("rtsp://"):]
        return s


class CameraRead(ORMModel):
    id: int
    lab_id: int
    lab_name: str | None = None
    name: str
    role: CameraRoleLiteral
    rtsp_url: str | None = Field(
        default=None, description="RTSP URL with the password masked."
    )
    enabled: bool
    status: CameraStatusLiteral
    last_seen_at: dt.datetime | None
    last_error: str | None
    created_at: dt.datetime
    stream_url: str | None = Field(
        default=None, description="Relative path of the MJPEG live view for this camera."
    )

    @field_validator("rtsp_url")
    @classmethod
    def _mask(cls, v: str | None) -> str | None:
        return mask_rtsp_url(v)


class CameraTestResult(BaseModel):
    """Result of trying to read a single frame from a camera."""

    ok: bool
    camera_id: int | None = None
    width: int | None = None
    height: int | None = None
    elapsed_ms: float | None = None
    detail: str


# --------------------------------------------------------------------------
# Entry log
# --------------------------------------------------------------------------
class EntryPersonRead(BaseModel):
    id: int
    id_number: str
    full_name: str
    person_type: PersonTypeLiteral


class EntryLogRead(ORMModel):
    id: int
    entered_at: dt.datetime
    status: EntryStatusLiteral
    similarity: float | None
    person: EntryPersonRead | None
    lab_id: int
    lab_name: str | None = None
    camera_id: int | None
    camera_name: str | None = None
    snapshot_path: str | None


class ManualEntryCreate(BaseModel):
    """Body for recording an entry without a camera (testing and fallback)."""

    person_id: int | None = Field(
        default=None, description="Omit to record an UNKNOWN entry."
    )
    lab_id: int
    camera_id: int | None = None
    entered_at: dt.datetime | None = Field(
        default=None, description="Defaults to now (UTC)."
    )
    similarity: float | None = None
    bypass_cooldown: bool = False


class EntryDecision(BaseModel):
    """What the entry rules decided about one recognized face."""

    logged: bool
    reason: Literal[
        "logged", "cooldown", "below_threshold_unknown", "no_faces", "lab_inactive"
    ]
    entry: EntryLogRead | None = None
    similarity: float | None = None
    matched_person_id: int | None = None


# --------------------------------------------------------------------------
# Recognition (manual testing endpoints)
# --------------------------------------------------------------------------
class FaceMatch(BaseModel):
    person_id: int
    id_number: str
    full_name: str
    similarity: float


class DetectedFaceRead(BaseModel):
    bbox: list[float] = Field(description="[x1, y1, x2, y2] in pixels.")
    det_score: float
    match: FaceMatch | None = Field(
        default=None, description="Closest enrolled person, if any embedding exists."
    )
    accepted: bool = Field(
        description="True when the similarity reached the threshold used for the request."
    )


class RecognizeResult(BaseModel):
    engine: str
    threshold: float
    faces: list[DetectedFaceRead]


# --------------------------------------------------------------------------
# Dashboard statistics
# --------------------------------------------------------------------------
class HourBucket(BaseModel):
    hour: int = Field(ge=0, le=23)
    count: int


class LabTotal(BaseModel):
    lab_id: int
    lab_name: str
    count: int


class TodayStats(BaseModel):
    date: dt.date
    entries_today: int
    distinct_persons_today: int
    unknown_today: int
    cameras_online: int
    cameras_total: int
    entries_per_hour: list[HourBucket]
    per_lab: list[LabTotal]
    latest_entries: list[EntryLogRead]


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
class CameraHealth(BaseModel):
    id: int
    name: str
    lab_name: str | None
    role: CameraRoleLiteral
    status: CameraStatusLiteral
    worker_running: bool
    last_seen_at: dt.datetime | None
    last_error: str | None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    app: str
    version: str
    environment: str
    database_reachable: bool
    recognition_engine: str
    recognition_ready: bool
    embedding_dim: int
    cameras_online: int
    cameras_offline: int
    cameras: list[CameraHealth]


class ErrorDetail(BaseModel):
    """Standard error body returned by the API."""

    detail: str
