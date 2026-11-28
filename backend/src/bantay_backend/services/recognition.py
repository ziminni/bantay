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

import cv2
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


@dataclass(slots=True)
class FacePose:
    """Head pose and mirrored screen position for live enrollment guidance."""

    yaw_deg: float
    pitch_deg: float
    roll_deg: float
    nose_x_ratio: float
    nose_y_ratio: float
    center_x: float
    center_y: float
    size: float
    det_score: float


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

    def detect_pose(self, frame: np.ndarray) -> FacePose | None:
        """Return the 3D head pose of the largest face without running ArcFace."""
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

    def detect_pose(self, frame: np.ndarray) -> FacePose | None:
        return None


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

    def detect_pose(self, frame: np.ndarray) -> FacePose | None:
        from insightface.app.common import Face  # noqa: PLC0415

        h, w = frame.shape[:2]
        if h == 0 or w == 0:
            return None
        if max(h, w) > 320:
            scale = 320.0 / float(max(h, w))
            small = cv2.resize(frame, (max(1, int(w * scale)), max(1, int(h * scale))))
        else:
            small = frame

        sh, sw = small.shape[:2]
        lmk3d = self._app.models.get("landmark_3d_68")

        with self._lock:
            bboxes, kpss = self._app.det_model.detect(small, input_size=(320, 320), max_num=0)
            if bboxes is None or len(bboxes) == 0:
                return None

            idx = max(
                range(len(bboxes)),
                key=lambda i: max(0.0, float(bboxes[i, 2] - bboxes[i, 0]))
                * max(0.0, float(bboxes[i, 3] - bboxes[i, 1])),
            )
            x1, y1, x2, y2, score = (float(v) for v in bboxes[idx])
            kps = kpss[idx] if kpss is not None else None
            face_obj = Face(bbox=bboxes[idx, 0:4], kps=kps, det_score=score)
            if lmk3d is not None:
                lmk3d.get(small, face_obj)

        # Convert to mirrored selfie coordinates matching the UI preview (-scale-x-100):
        # negative yaw = user's left, positive yaw = user's right;
        # negative pitch = chin tilted up, positive pitch = head tilted down.
        pose = getattr(face_obj, "pose", None)
        if pose is not None and len(pose) >= 3:
            pitch_deg = -float(pose[0])
            yaw_deg = -float(pose[1])
            roll_deg = -float(pose[2])
        else:
            pitch_deg = 0.0
            yaw_deg = 0.0
            roll_deg = 0.0

        if kps is not None and len(kps) >= 5:
            eye_mid_x = float((kps[0][0] + kps[1][0]) * 0.5)
            eye_dist = max(float(np.hypot(kps[1][0] - kps[0][0], kps[1][1] - kps[0][1])), 1.0)
            eye_mid_y = float((kps[0][1] + kps[1][1]) * 0.5)
            mouth_mid_y = float((kps[3][1] + kps[4][1]) * 0.5)
            nose_x_ratio = -float((kps[2][0] - eye_mid_x) / eye_dist)
            nose_y_ratio = float((kps[2][1] - eye_mid_y) / max(mouth_mid_y - eye_mid_y, 1.0))
        else:
            nose_x_ratio = yaw_deg / 45.0
            nose_y_ratio = 0.56

        return FacePose(
            yaw_deg=yaw_deg,
            pitch_deg=pitch_deg,
            roll_deg=roll_deg,
            nose_x_ratio=nose_x_ratio,
            nose_y_ratio=nose_y_ratio,
            center_x=1.0 - float((x1 + x2) * 0.5 / max(sw, 1)),
            center_y=float((y1 + y2) * 0.5 / max(sh, 1)),
            size=float((x2 - x1) / max(sw, 1)),
            det_score=score,
        )


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
