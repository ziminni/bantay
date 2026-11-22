"""Application configuration, read from environment variables / .env."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings for the Bantay backend.

    Every value can be overridden with an environment variable of the same
    name (case-insensitive) or by an entry in a local ``.env`` file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -- Application ----------------------------------------------------
    app_name: str = "Bantay"
    environment: Literal["development", "production"] = "development"
    debug: bool = True

    # -- Database -------------------------------------------------------
    database_url: str = Field(
        default="postgresql+psycopg://bantay:bantay@localhost:5432/bantay",
        description="SQLAlchemy URL for PostgreSQL. Must use the psycopg (v3) driver.",
    )
    db_echo: bool = False
    db_auto_create: bool = Field(
        default=False,
        description=(
            "Development convenience: create tables on startup instead of "
            "running Alembic migrations. Never enable in production."
        ),
    )

    # -- CORS -----------------------------------------------------------
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Origins allowed to call the API (the Vite dev server by default).",
    )

    # -- Recognition ----------------------------------------------------
    recognition_engine: Literal["auto", "insightface", "null"] = Field(
        default="auto",
        description=(
            "Which face recognition engine to load. 'auto' uses InsightFace when "
            "it is installed and falls back to the null engine otherwise, so the "
            "API can run on a machine without the AI stack."
        ),
    )
    insightface_model: str = Field(
        default="buffalo_l",
        description="InsightFace model pack providing detection (SCRFD) and ArcFace recognition.",
    )
    insightface_ctx_id: int = Field(
        default=-1,
        description="GPU device index for InsightFace. -1 selects CPU.",
    )
    insightface_det_size: int = 640
    embedding_dim: int = Field(
        default=512,
        description="Dimension of an ArcFace embedding. Must match the database column.",
    )
    adapter_path: str | None = Field(
        default=None,
        description=(
            "Optional path to the fine-tuned LabAdapter in ONNX format. When unset, "
            "raw ArcFace embeddings are used unchanged."
        ),
    )

    # -- Entry rules ----------------------------------------------------
    default_match_threshold: float = Field(
        default=0.45,
        ge=0.0,
        le=1.0,
        description=(
            "Default cosine similarity at or above which a face is accepted as a "
            "match. Tuned per laboratory during fine-tuning."
        ),
    )
    default_cooldown_seconds: int = Field(
        default=120,
        ge=0,
        description=(
            "Default period after logging a person in a laboratory during which the "
            "same person is not logged again there."
        ),
    )
    min_enrollment_photos: int = Field(default=3, ge=1)
    max_enrollment_photos: int = Field(default=5, ge=1)
    min_enrollment_det_score: float = Field(
        default=0.60,
        description="Minimum detector confidence for an enrollment photo to be accepted.",
    )

    # -- Camera workers -------------------------------------------------
    camera_workers_enabled: bool = Field(
        default=True,
        description="Start the RTSP camera workers on application startup.",
    )
    camera_sample_fps: float = Field(
        default=10.0,
        gt=0,
        description="Frames per second sampled from each entrance stream for recognition.",
    )
    camera_reconnect_min_seconds: float = 2.0
    camera_reconnect_max_seconds: float = 60.0
    camera_read_timeout_seconds: float = 10.0
    stream_fps: float = Field(
        default=10.0,
        gt=0,
        description="Maximum frames per second pushed to the browser over MJPEG.",
    )
    stream_jpeg_quality: int = Field(default=80, ge=1, le=100)

    # -- Media ----------------------------------------------------------
    media_root: str = Field(
        default="./media",
        description="Directory holding unknown-face snapshots. Enrollment photos are never written here.",
    )
    store_unknown_snapshots: bool = True

    @property
    def api_prefix(self) -> str:
        return "/api/v1"


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()


settings = get_settings()
