"""Temporary sessions for mobile companion face enrollment.

Allows a user on a desktop/laptop to generate a QR code with a temporary
session token. When scanned on a smartphone, the phone opens a mobile-optimized
capture page to take selfies natively, which are pushed to this session and
subsequently received by the desktop client in real-time.
"""

from __future__ import annotations

import datetime as dt
import logging
import os
import shutil
import socket
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Enrollment Sessions"])

SESSION_TTL_MINUTES = 15
MAX_PHOTOS_PER_SESSION = 5
MAX_PHOTO_BYTES = 10 * 1024 * 1024
BASE_TEMP_DIR = Path(tempfile.gettempdir()) / "bantay_enrollment_sessions"
BASE_TEMP_DIR.mkdir(parents=True, exist_ok=True)


def get_local_ip() -> str:
    """Detect the host machine's primary local LAN IP address."""
    # Attempt UDP connect to external/broadcast IP (no actual packets sent)
    for probe in [("10.255.255.255", 1), ("8.8.8.8", 80)]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(probe)
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127."):
                return ip
        except Exception:
            continue
    return "127.0.0.1"


@dataclass
class SessionPhoto:
    index: int
    filename: str
    content_type: str
    size: int
    file_path: Path


@dataclass
class EnrollmentSession:
    id: str
    created_at: dt.datetime
    expires_at: dt.datetime
    temp_dir: Path
    status: Literal["pending", "received", "completed", "expired"] = "pending"
    photos: list[SessionPhoto] = field(default_factory=list)

    def is_expired(self) -> bool:
        return dt.datetime.now(dt.timezone.utc) > self.expires_at

    def cleanup(self) -> None:
        try:
            if self.temp_dir.exists():
                shutil.rmtree(self.temp_dir, ignore_errors=True)
        except Exception as exc:
            logger.warning("Failed to clean temp dir %s: %s", self.temp_dir, exc)


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, EnrollmentSession] = {}
        self._lock = Lock()

    def purge_expired(self) -> None:
        with self._lock:
            now = dt.datetime.now(dt.timezone.utc)
            to_delete = [
                sid for sid, sess in self._sessions.items()
                if sess.expires_at < now or sess.status == "completed"
            ]
            for sid in to_delete:
                sess = self._sessions.pop(sid, None)
                if sess:
                    sess.cleanup()

    def create(self) -> EnrollmentSession:
        self.purge_expired()
        session_id = uuid.uuid4().hex[:12]
        session_dir = BASE_TEMP_DIR / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        now = dt.datetime.now(dt.timezone.utc)
        expires = now + dt.timedelta(minutes=SESSION_TTL_MINUTES)
        session = EnrollmentSession(
            id=session_id,
            created_at=now,
            expires_at=expires,
            temp_dir=session_dir,
            status="pending",
        )
        with self._lock:
            self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> EnrollmentSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            if session.is_expired():
                session.status = "expired"
                session.cleanup()
                self._sessions.pop(session_id, None)
                return None
            return session

    def delete(self, session_id: str) -> None:
        with self._lock:
            session = self._sessions.pop(session_id, None)
            if session:
                session.cleanup()


store = SessionStore()


# --- Pydantic Schemas ---

class PhotoMeta(BaseModel):
    index: int
    filename: str
    content_type: str
    size: int
    url: str


class SessionCreateResponse(BaseModel):
    session_id: str
    created_at: dt.datetime
    expires_at: dt.datetime
    network_ip: str
    expires_in_seconds: int = 900


class SessionStatusResponse(BaseModel):
    session_id: str
    status: Literal["pending", "received", "completed", "expired"]
    created_at: dt.datetime
    expires_at: dt.datetime
    photo_count: int
    photos: list[PhotoMeta]


class NetworkIpResponse(BaseModel):
    network_ip: str


# --- Routes ---

@router.get("/system/network-ip", response_model=NetworkIpResponse, summary="Get LAN IP address")
def get_system_network_ip() -> NetworkIpResponse:
    """Return the server's local LAN IP for QR code generation."""
    return NetworkIpResponse(network_ip=get_local_ip())


@router.post(
    "/enrollment-sessions",
    response_model=SessionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a temporary mobile face enrollment session",
)
def create_session() -> SessionCreateResponse:
    session = store.create()
    ip = get_local_ip()
    return SessionCreateResponse(
        session_id=session.id,
        created_at=session.created_at,
        expires_at=session.expires_at,
        network_ip=ip,
        expires_in_seconds=int((session.expires_at - session.created_at).total_seconds()),
    )


@router.get(
    "/enrollment-sessions/{session_id}",
    response_model=SessionStatusResponse,
    summary="Check status of a mobile enrollment session",
)
def get_session_status(session_id: str) -> SessionStatusResponse:
    session = store.get(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment session not found or has expired.",
        )

    photos_meta = [
        PhotoMeta(
            index=p.index,
            filename=p.filename,
            content_type=p.content_type,
            size=p.size,
            url=f"/api/v1/enrollment-sessions/{session_id}/photos/{p.index}",
        )
        for p in session.photos
    ]

    return SessionStatusResponse(
        session_id=session.id,
        status=session.status,
        created_at=session.created_at,
        expires_at=session.expires_at,
        photo_count=len(session.photos),
        photos=photos_meta,
    )


@router.post(
    "/enrollment-sessions/{session_id}/photos",
    summary="Upload photos from mobile device to this session",
)
async def upload_session_photos(
    session_id: str,
    files: list[UploadFile] = File(..., description="Selfie photos from phone camera."),
) -> SessionStatusResponse:
    session = store.get(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment session not found or expired.",
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No photo files were received.",
        )

    if len(files) > MAX_PHOTOS_PER_SESSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At most {MAX_PHOTOS_PER_SESSION} photos can be uploaded per session.",
        )

    # Clear any previous photos in this session
    session.photos.clear()
    for existing in session.temp_dir.glob("*"):
        try:
            if existing.is_file():
                existing.unlink()
        except Exception:
            pass

    for idx, upload in enumerate(files):
        filename = upload.filename or f"selfie_{idx + 1}.jpg"
        content_type = upload.content_type or "image/jpeg"
        content = await upload.read()

        if len(content) > MAX_PHOTO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Photo {filename} exceeds maximum size of 10MB.",
            )

        # Sanitize extension
        ext = os.path.splitext(filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ".jpg"
        save_name = f"photo_{idx + 1}{ext}"
        target_path = session.temp_dir / save_name

        with open(target_path, "wb") as f:
            f.write(content)

        session.photos.append(
            SessionPhoto(
                index=idx,
                filename=save_name,
                content_type=content_type,
                size=len(content),
                file_path=target_path,
            )
        )

    session.status = "received"
    logger.info("Session %s received %d photos from mobile device", session_id, len(session.photos))

    photos_meta = [
        PhotoMeta(
            index=p.index,
            filename=p.filename,
            content_type=p.content_type,
            size=p.size,
            url=f"/api/v1/enrollment-sessions/{session_id}/photos/{p.index}",
        )
        for p in session.photos
    ]

    return SessionStatusResponse(
        session_id=session.id,
        status=session.status,
        created_at=session.created_at,
        expires_at=session.expires_at,
        photo_count=len(session.photos),
        photos=photos_meta,
    )


@router.get(
    "/enrollment-sessions/{session_id}/photos/{photo_idx}",
    summary="Download or preview an uploaded photo from this session",
)
def get_session_photo(session_id: str, photo_idx: int) -> FileResponse:
    session = store.get(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment session not found or expired.",
        )

    matching = [p for p in session.photos if p.index == photo_idx]
    if not matching or not matching[0].file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Photo with index {photo_idx} not found in this session.",
        )

    photo = matching[0]
    return FileResponse(
        path=str(photo.file_path),
        media_type=photo.content_type,
        filename=photo.filename,
    )


@router.delete(
    "/enrollment-sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark session completed and clean up temporary files",
)
def close_session(session_id: str) -> None:
    store.delete(session_id)
