"""RTSP camera workers.

One worker thread per enabled camera. Each worker:

* opens its RTSP stream with OpenCV and reconnects with an increasing delay
  when the stream drops,
* samples frames at the configured rate,
* for ENTRY cameras, runs detection + embedding and hands each face to the
  entry rules,
* keeps the latest annotated frame as a JPEG so the API can serve the MJPEG
  live view without touching the camera again.

A camera that fails never stops the other cameras or the API.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field

import cv2
import numpy as np
from sqlalchemy import select

from ..config import settings
from ..db import session_scope
from ..models import Camera, CameraRole, CameraStatus, Lab
from .entry_logging import record_entry
from .matching import find_closest
from .recognition import get_engine

logger = logging.getLogger(__name__)


@dataclass
class FrameBuffer:
    """Holds the most recent annotated JPEG for one camera."""

    jpeg: bytes | None = None
    updated_at: float = 0.0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _event: threading.Event = field(default_factory=threading.Event, repr=False)

    def set(self, jpeg: bytes) -> None:
        with self._lock:
            self.jpeg = jpeg
            self.updated_at = time.monotonic()
        self._event.set()
        self._event.clear()

    def clear(self) -> None:
        with self._lock:
            self.jpeg = None
            self.updated_at = 0.0

    def get(self, max_age: float = 2.5) -> bytes | None:
        with self._lock:
            if self.jpeg is None:
                return None
            if time.monotonic() - self.updated_at > max_age:
                return None
            return self.jpeg

    def wait_for_new(self, timeout: float) -> bool:
        return self._event.wait(timeout)


@dataclass(slots=True)
class FaceOverlay:
    """Carries face bounding box and match metadata for stream annotation."""

    bbox: tuple[float, float, float, float]
    det_score: float
    display_name: str = "Unknown"
    has_match: bool = False
    matched: bool = False
    similarity: float | None = None


def _placeholder_jpeg(text: str, width: int = 640, height: int = 360) -> bytes:
    """A grey frame with a message, shown when a camera has no picture."""
    img = np.full((height, width, 3), 40, dtype=np.uint8)
    cv2.putText(
        img, text, (20, height // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2
    )
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes() if ok else b""


def _open_capture(url: str | int) -> cv2.VideoCapture:
    """Open a video capture stream or local webcam using the best available backend.

    Supports:
      - Local webcams: '0', 0, 'webcam://0', 'webcam', 'device://0'
      - Network streams: RTSP, HTTP MJPEG, HTTPS, etc.
    """
    raw = str(url).strip()

    is_device = False
    device_index = 0

    if isinstance(url, int):
        is_device = True
        device_index = url
    elif raw.isdigit():
        is_device = True
        device_index = int(raw)
    elif raw.startswith(("webcam://", "device://")):
        is_device = True
        remainder = raw.split("://", 1)[1]
        device_index = int(remainder) if remainder.isdigit() else 0
    elif raw.lower() in ("webcam", "builtin", "laptop"):
        is_device = True
        device_index = 0

    if is_device:
        # On macOS, CAP_AVFOUNDATION is required for smooth built-in webcam capture
        if hasattr(cv2, "CAP_AVFOUNDATION"):
            cap = cv2.VideoCapture(device_index, cv2.CAP_AVFOUNDATION)
            if cap.isOpened():
                return cap
        return cv2.VideoCapture(device_index)

    # Clean accidental double protocol prefix if user pasted rtsp://http://
    if raw.startswith("rtsp://http://"):
        raw = raw[len("rtsp://"):]
    elif raw.startswith("rtsp://https://"):
        raw = raw[len("rtsp://"):]

    cap = cv2.VideoCapture(raw)
    if not cap.isOpened() and hasattr(cv2, "CAP_FFMPEG"):
        cap.release()
        cap = cv2.VideoCapture(raw, cv2.CAP_FFMPEG)
    return cap


class CameraWorker(threading.Thread):
    """Reads one camera and logs the entries it sees."""

    def __init__(self, camera_id: int, name: str, rtsp_url: str, role: str, lab_id: int):
        super().__init__(name=f"camera-{camera_id}", daemon=True)
        self.camera_id = camera_id
        self.camera_name = name
        self.rtsp_url = rtsp_url
        self.role = role
        self.lab_id = lab_id

        self.buffer = FrameBuffer()
        self._stop = threading.Event()
        self.connected = False
        self.last_error: str | None = None
        self.frames_read = 0
        self.entries_logged = 0

    # -- lifecycle ------------------------------------------------------
    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        backoff = settings.camera_reconnect_min_seconds
        while not self._stop.is_set():
            cap = None
            try:
                cap = _open_capture(self.rtsp_url)
                # Keep the decoder from queueing stale frames.
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                try:
                    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
                except Exception:
                    pass

                if not cap.isOpened():
                    raise RuntimeError("could not open the stream")

                self._set_connected(True, None)
                backoff = settings.camera_reconnect_min_seconds
                self._loop(cap)
            except Exception as exc:
                self._set_connected(False, str(exc))
                logger.warning(
                    "Camera %s (%s): %s -- retrying in %.0fs",
                    self.camera_id,
                    self.camera_name,
                    exc,
                    backoff,
                )
            finally:
                if cap is not None:
                    cap.release()

            if self._stop.wait(backoff):
                break
            backoff = min(backoff * 1.5, 6.0)

        self._set_connected(False, "stopped")
        logger.info("Camera worker %s stopped.", self.camera_id)

    # -- main loop ------------------------------------------------------
    def _loop(self, cap: cv2.VideoCapture) -> None:
        pub_interval = 1.0 / max(settings.stream_fps, 1.0)
        engine = get_engine()
        last_fail = 0
        last_pub = 0.0
        last_recog = 0.0
        recog_busy = False
        recog_lock = threading.Lock()
        active_faces: list = []
        faces_lock = threading.Lock()

        def run_recognition(recog_frame: np.ndarray) -> None:
            nonlocal recog_busy, active_faces
            try:
                found_faces = engine.detect(recog_frame)
                overlays: list[FaceOverlay] = []
                if found_faces:
                    overlays = self._handle_faces(found_faces, recog_frame)
                with faces_lock:
                    active_faces = overlays
            except Exception:
                logger.exception("Recognition failed on camera %s.", self.camera_id)
            finally:
                with recog_lock:
                    recog_busy = False

        while not self._stop.is_set():
            ok, frame = cap.read()

            if not ok or frame is None:
                last_fail += 1
                if last_fail > 30:
                    raise RuntimeError("stream returned no frames")
                time.sleep(0.05)
                continue

            last_fail = 0
            self.frames_read += 1

            now = time.monotonic()
            if self.role == CameraRole.ENTRY and engine.is_ready():
                with recog_lock:
                    if not recog_busy and (now - last_recog >= 0.5):
                        recog_busy = True
                        last_recog = now
                        threading.Thread(
                            target=run_recognition,
                            args=(frame.copy(),),
                            daemon=True,
                            name=f"recog-cam-{self.camera_id}",
                        ).start()

            # Throttle publishing to stream_fps so cv2.imencode does not overwhelm CPU
            if now - last_pub >= pub_interval:
                last_pub = now
                with faces_lock:
                    current_faces = list(active_faces) if (now - last_recog <= 1.5) else []
                self._publish(frame, current_faces)

    def _handle_faces(self, faces: list, frame: np.ndarray) -> list[FaceOverlay]:
        """Apply the entry rules to each detected face, in its own transaction."""
        overlays: list[FaceOverlay] = []
        try:
            with session_scope() as db:
                lab = db.get(Lab, self.lab_id)
                camera = db.get(Camera, self.camera_id)
                threshold = (
                    lab.match_threshold
                    if lab and lab.match_threshold is not None
                    else settings.default_match_threshold
                )
                for face in faces:
                    match = find_closest(db, face.embedding)
                    if lab and camera:
                        outcome = record_entry(
                            db, lab=lab, camera=camera, embedding=face.embedding, frame=frame
                        )
                        if outcome.logged:
                            self.entries_logged += 1

                    if match and match.similarity >= threshold:
                        overlays.append(
                            FaceOverlay(
                                bbox=face.bbox,
                                det_score=face.det_score,
                                display_name=match.full_name,
                                has_match=True,
                                matched=True,
                                similarity=match.similarity,
                            )
                        )
                    else:
                        overlays.append(
                            FaceOverlay(
                                bbox=face.bbox,
                                det_score=face.det_score,
                                display_name="Unknown",
                                has_match=False,
                                matched=False,
                                similarity=None,
                            )
                        )
        except Exception:
            logger.exception("Could not process faces for camera %s.", self.camera_id)
            if not overlays:
                for face in faces:
                    overlays.append(
                        FaceOverlay(
                            bbox=face.bbox,
                            det_score=face.det_score,
                            display_name="Unknown",
                            has_match=False,
                            matched=False,
                            similarity=None,
                        )
                    )
        return overlays

    def _publish(self, frame: np.ndarray, faces: list[FaceOverlay]) -> None:
        """Draw boxes and labels styled identically to Test Recognition, then store the JPEG."""
        annotated = frame
        if faces:
            annotated = frame.copy()
            h, w = annotated.shape[:2]

            for face in faces:
                x1, y1, x2, y2 = (int(v) for v in face.bbox)
                matched = face.matched
                has_match = face.has_match
                name = face.display_name or "Unknown"
                sim = face.similarity

                # Color palette and text matching ImageWithBoxes.tsx:
                # - Match (at or above threshold): Emerald-400 border, Emerald-600 badge, FullName · XX%
                # - Below threshold / unregistered: White border, Gray-900 badge, "Unknown"
                if matched and sim is not None:
                    box_color = (153, 211, 52)      # Emerald-400
                    outline_color = (20, 44, 2)     # Emerald-950
                    badge_color = (105, 150, 5)     # Emerald-600
                    text = f"{name} · {int(round(sim * 100))}%"
                else:
                    box_color = (255, 255, 255)     # White
                    outline_color = (39, 24, 17)    # Gray-900
                    badge_color = (39, 24, 17)      # Gray-900
                    text = "Unknown"

                # 1. Outer dark outline + Inner crisp box (matching border-2 outline-2)
                cv2.rectangle(annotated, (x1 - 1, y1 - 1), (x2 + 1, y2 + 1), outline_color, 4)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, 2)

                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.5
                thickness = 1

                (tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
                pad_x = 6
                pad_y = 4
                badge_w = tw + pad_x * 2
                badge_h = th + pad_y * 2

                # Collision check with top edge (matching isNearTop logic)
                is_near_top = y1 < (badge_h + 8)
                if is_near_top:
                    badge_x1 = max(4, x1 + 4)
                    badge_y1 = y1 + 4
                else:
                    badge_x1 = max(4, x1)
                    badge_y1 = y1 - badge_h - 4

                badge_x2 = min(w - 4, badge_x1 + badge_w)
                badge_y2 = badge_y1 + badge_h

                # Drop shadow / dark outline for badge (shadow-md)
                cv2.rectangle(annotated, (badge_x1 - 1, badge_y1 - 1), (badge_x2 + 1, badge_y2 + 1), (15, 23, 42), -1)
                # Badge pill background
                cv2.rectangle(annotated, (badge_x1, badge_y1), (badge_x2, badge_y2), badge_color, -1)

                # Text inside badge in crisp anti-aliased white
                text_x = badge_x1 + pad_x
                text_y = badge_y1 + pad_y + th
                cv2.putText(
                    annotated,
                    text,
                    (text_x, text_y),
                    font,
                    font_scale,
                    (255, 255, 255),
                    thickness,
                    cv2.LINE_AA,
                )

        ok, buf = cv2.imencode(
            ".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, settings.stream_jpeg_quality]
        )
        if ok:
            self.buffer.set(buf.tobytes())

    # -- status ---------------------------------------------------------
    def _set_connected(self, connected: bool, error: str | None) -> None:
        self.connected = connected
        self.last_error = error
        if not connected:
            self.buffer.clear()
        try:
            with session_scope() as db:
                camera = db.get(Camera, self.camera_id)
                if camera is not None:
                    camera.status = (
                        CameraStatus.ONLINE if connected else CameraStatus.OFFLINE
                    )
                    camera.last_error = error
                    if connected:
                        import datetime as dt  # noqa: PLC0415

                        camera.last_seen_at = dt.datetime.now(dt.UTC)
        except Exception:
            logger.exception("Could not update the status of camera %s.", self.camera_id)


class CameraManager:
    """Starts, stops and restarts the camera workers."""

    def __init__(self) -> None:
        self._workers: dict[int, CameraWorker] = {}
        self._lock = threading.Lock()

    def start_all(self) -> int:
        """Start a worker for every enabled camera. Returns how many started."""
        if not settings.camera_workers_enabled:
            logger.info("Camera workers are disabled by configuration.")
            return 0

        try:
            with session_scope() as db:
                cameras = (
                    db.execute(select(Camera).where(Camera.enabled.is_(True)))
                    .scalars()
                    .all()
                )
                specs = [
                    (c.id, c.name, c.rtsp_url, c.role, c.lab_id) for c in cameras
                ]
        except Exception:
            logger.exception("Could not read the camera list; no workers started.")
            return 0

        for spec in specs:
            self._start(*spec)
        logger.info("Started %s camera worker(s).", len(specs))
        return len(specs)

    def _start(self, camera_id: int, name: str, rtsp_url: str, role: str, lab_id: int) -> None:
        with self._lock:
            existing = self._workers.pop(camera_id, None)
            if existing is not None:
                existing.stop()
            worker = CameraWorker(camera_id, name, rtsp_url, role, lab_id)
            self._workers[camera_id] = worker
            worker.start()

    def restart(self, camera_id: int) -> bool:
        """Restart one camera after its configuration changed."""
        try:
            with session_scope() as db:
                camera = db.get(Camera, camera_id)
                if camera is None:
                    self.stop_one(camera_id)
                    return False
                if not camera.enabled or not settings.camera_workers_enabled:
                    self.stop_one(camera_id)
                    camera.status = CameraStatus.DISABLED
                    return False
                spec = (camera.id, camera.name, camera.rtsp_url, camera.role, camera.lab_id)
        except Exception:
            logger.exception("Could not restart camera %s.", camera_id)
            return False

        self._start(*spec)
        return True

    def stop_one(self, camera_id: int) -> None:
        with self._lock:
            worker = self._workers.pop(camera_id, None)
        if worker is not None:
            worker.stop()

    def stop_all(self) -> None:
        with self._lock:
            workers = list(self._workers.values())
            self._workers.clear()
        for worker in workers:
            worker.stop()
        for worker in workers:
            worker.join(timeout=3.0)
        logger.info("All camera workers stopped.")

    def get(self, camera_id: int) -> CameraWorker | None:
        with self._lock:
            return self._workers.get(camera_id)

    def is_running(self, camera_id: int) -> bool:
        worker = self.get(camera_id)
        return bool(worker and worker.is_alive())

    def frame(self, camera_id: int) -> bytes | None:
        worker = self.get(camera_id)
        return worker.buffer.get() if worker else None

    @property
    def running_ids(self) -> set[int]:
        with self._lock:
            return {cid for cid, w in self._workers.items() if w.is_alive()}


manager = CameraManager()


def probe_camera(rtsp_url: str, timeout: float | None = None) -> tuple[bool, dict]:
    """Try to read a single frame. Used by the 'Test' button in Management."""
    started = time.monotonic()
    cap = None
    try:
        cap = _open_capture(rtsp_url)
        if not cap.isOpened():
            return False, {"detail": "Could not open the stream."}
        ok, frame = False, None
        deadline = time.monotonic() + (timeout or 2.5)
        while time.monotonic() < deadline:
            ok, frame = cap.read()
            if ok and frame is not None:
                break
            time.sleep(0.05)

        if not ok or frame is None:
            return False, {"detail": "The stream opened but returned no frame."}
        height, width = frame.shape[:2]
        return True, {
            "width": int(width),
            "height": int(height),
            "elapsed_ms": round((time.monotonic() - started) * 1000, 1),
            "detail": "Read one frame successfully.",
        }
    except Exception as exc:
        return False, {"detail": f"Error reading the stream: {exc}"}
    finally:
        if cap is not None:
            cap.release()
