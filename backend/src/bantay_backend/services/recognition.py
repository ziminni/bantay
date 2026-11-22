"""Face detection and embedding.

The rest of the backend talks to a ``RecognitionEngine`` and never imports
InsightFace directly. Two implementations exist:

* ``InsightFaceEngine`` -- detection (SCRFD) and ArcFace recognition from the
  InsightFace model pack, optionally followed by the fine-tuned LabAdapter.
* ``NullEngine``       -- a stand-in that detects nothing, so that the API,
  the database and the dashboard can run on a machine without the AI stack
  (for example a laptop with no NVIDIA GPU).

The engine is selected by the ``recognition_engine`` setting.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Protocol

import numpy as np

from ..config import settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class DetectedFace:
    """One face found in a frame."""

    bbox: tuple[float, float, float, float]
    det_score: float
    embedding: np.ndarray = field(repr=False)

    @property
    def area(self) -> float:
        x1, y1, x2, y2 = self.bbox
        return max(0.0, x2 - x1) * max(0.0, y2 - y1)


def l2_normalize(vec: np.ndarray) -> np.ndarray:
    """Scale a vector to unit length so that dot product equals cosine similarity."""
    vec = np.asarray(vec, dtype=np.float32).ravel()
    norm = float(np.linalg.norm(vec))
    if norm == 0.0:
        return vec
    return vec / norm


class RecognitionEngine(Protocol):
    """Interface every recognition backend implements."""

    name: str

    def is_ready(self) -> bool: ...

    def detect(self, frame: np.ndarray) -> list[DetectedFace]:
        """Return every face in a BGR frame, with a normalized embedding."""
        ...


class NullEngine:
    """Detects nothing. Keeps the whole system runnable without the AI stack."""

    name = "null"

    def __init__(self, reason: str = "") -> None:
        self._reason = reason
        self._warned = False

    def is_ready(self) -> bool:
        return False

    def detect(self, frame: np.ndarray) -> list[DetectedFace]:
        if not self._warned:
            logger.warning(
                "Recognition is disabled (%s). Faces will not be detected; "
                "install the AI stack and set RECOGNITION_ENGINE=insightface.",
                self._reason or "null engine selected",
            )
            self._warned = True
        return []


class _Adapter:
    """Optional fine-tuned LabAdapter applied to raw ArcFace embeddings."""

    def __init__(self, onnx_path: str) -> None:
        import onnxruntime as ort  # noqa: PLC0415 -- optional dependency

        providers = ["CPUExecutionProvider"]
        if settings.insightface_ctx_id >= 0:
            providers.insert(0, "CUDAExecutionProvider")
        self._session = ort.InferenceSession(onnx_path, providers=providers)
        self._input = self._session.get_inputs()[0].name
        logger.info("LabAdapter loaded from %s", onnx_path)

    def apply(self, embedding: np.ndarray) -> np.ndarray:
        out = self._session.run(
            None, {self._input: embedding.reshape(1, -1).astype(np.float32)}
        )[0]
        return l2_normalize(np.asarray(out))


class InsightFaceEngine:
    """SCRFD detection plus ArcFace embedding from an InsightFace model pack."""

    name = "insightface"

    def __init__(self) -> None:
        from insightface.app import FaceAnalysis  # noqa: PLC0415 -- optional dependency

        self._app = FaceAnalysis(name=settings.insightface_model)
        det = settings.insightface_det_size
        self._app.prepare(ctx_id=settings.insightface_ctx_id, det_size=(det, det))
        self._lock = threading.Lock()

        self._adapter: _Adapter | None = None
        if settings.adapter_path:
            try:
                self._adapter = _Adapter(settings.adapter_path)
            except Exception:
                logger.exception(
                    "Could not load the LabAdapter at %s; using raw ArcFace embeddings.",
                    settings.adapter_path,
                )

        logger.info(
            "InsightFace ready (model=%s, ctx_id=%s, adapter=%s)",
            settings.insightface_model,
            settings.insightface_ctx_id,
            bool(self._adapter),
        )

    def is_ready(self) -> bool:
        return True

    def detect(self, frame: np.ndarray) -> list[DetectedFace]:
        # FaceAnalysis is not documented as thread-safe and the camera workers
        # each run on their own thread, so calls are serialized.
        with self._lock:
            faces = self._app.get(frame)

        out: list[DetectedFace] = []
        for f in faces:
            emb = l2_normalize(np.asarray(f.normed_embedding, dtype=np.float32))
            if self._adapter is not None:
                emb = self._adapter.apply(emb)
            if emb.shape[0] != settings.embedding_dim:
                logger.error(
                    "Embedding dimension %s does not match the configured %s; skipping face.",
                    emb.shape[0],
                    settings.embedding_dim,
                )
                continue
            x1, y1, x2, y2 = (float(v) for v in f.bbox)
            out.append(
                DetectedFace(
                    bbox=(x1, y1, x2, y2),
                    det_score=float(f.det_score),
                    embedding=emb,
                )
            )
        return out


_engine: RecognitionEngine | None = None
_engine_lock = threading.Lock()


def get_engine() -> RecognitionEngine:
    """Return the process-wide recognition engine, building it on first use."""
    global _engine
    if _engine is not None:
        return _engine

    with _engine_lock:
        if _engine is not None:
            return _engine

        choice = settings.recognition_engine
        if choice == "null":
            _engine = NullEngine("RECOGNITION_ENGINE=null")
            return _engine

        try:
            _engine = InsightFaceEngine()
        except ImportError as exc:
            if choice == "insightface":
                raise RuntimeError(
                    "RECOGNITION_ENGINE=insightface but InsightFace is not installed. "
                    "Install it with: uv add insightface onnxruntime"
                ) from exc
            logger.warning("InsightFace is not installed; falling back to the null engine.")
            _engine = NullEngine("insightface is not installed")
        except Exception as exc:
            if choice == "insightface":
                raise
            logger.warning("InsightFace failed to start (%s); using the null engine.", exc)
            _engine = NullEngine(f"insightface failed to start: {exc}")

        return _engine


def reset_engine() -> None:
    """Drop the cached engine. Used by tests."""
    global _engine
    with _engine_lock:
        _engine = None
