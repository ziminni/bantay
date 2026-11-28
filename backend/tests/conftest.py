"""Test fixtures.

The tests run against a real PostgreSQL with pgvector, because the entry rules
depend on the vector search. Each test gets a clean set of tables.

Start the database first:  docker compose up -d db
"""

from __future__ import annotations

import os

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

os.environ.setdefault("CAMERA_WORKERS_ENABLED", "false")
os.environ.setdefault("RECOGNITION_ENGINE", "null")

from bantay_backend.db import Base, SessionLocal, engine  # noqa: E402
from bantay_backend.main import app  # noqa: E402
from bantay_backend.services.recognition import DetectedFace, FacePose, l2_normalize  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def _clean():
    """Empty every table before each test."""
    with engine.begin() as conn:
        conn.execute(
            text("TRUNCATE behavior_flag, entry_log, face_embedding, camera, lab, person RESTART IDENTITY CASCADE")
        )
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def rng():
    return np.random.default_rng(1234)


@pytest.fixture
def embedding(rng):
    """A deterministic unit-length embedding standing in for a real face."""

    def _make(seed: int = 0) -> np.ndarray:
        local = np.random.default_rng(seed)
        return l2_normalize(local.normal(size=512).astype(np.float32))

    return _make


class StubEngine:
    """A recognition engine that returns embeddings handed to it by the test."""

    name = "stub"

    def __init__(
        self,
        faces: list[DetectedFace] | None = None,
        pose: FacePose | None = None,
    ):
        self.faces = faces or []
        self.pose = pose

    def is_ready(self) -> bool:
        return True

    def detect(self, frame):
        return self.faces

    def detect_pose(self, frame) -> FacePose | None:
        return self.pose
