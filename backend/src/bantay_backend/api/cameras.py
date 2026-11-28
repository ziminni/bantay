"""Camera management and the MJPEG live view."""

from __future__ import annotations

import time
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Camera, CameraStatus, Lab
from ..schemas import CameraCreate, CameraRead, CameraTestResult, CameraUpdate, CameraZone
from ..services.camera_worker import _placeholder_jpeg, manager, probe_camera

router = APIRouter(prefix="/cameras", tags=["Cameras & Live View"])

BOUNDARY = "bantayframe"


def _to_read(camera: Camera, lab_name: str | None = None) -> CameraRead:
    return CameraRead(
        id=camera.id,
        lab_id=camera.lab_id,
        lab_name=lab_name,
        name=camera.name,
        role=camera.role,
        rtsp_url=camera.rtsp_url,
        enabled=camera.enabled,
        status=camera.status,
        last_seen_at=camera.last_seen_at,
        last_error=camera.last_error,
        zones=camera.zones or [],
        created_at=camera.created_at,
        stream_url=f"{settings.api_prefix}/cameras/{camera.id}/stream.mjpeg",
    )


@router.get("", response_model=list[CameraRead], summary="List cameras")
def list_cameras(
    db: Session = Depends(get_db),
    lab_id: int | None = Query(None),
    enabled: bool | None = Query(None),
) -> list[CameraRead]:
    stmt = select(Camera, Lab.name).join(Lab, Lab.id == Camera.lab_id)
    if lab_id is not None:
        stmt = stmt.where(Camera.lab_id == lab_id)
    if enabled is not None:
        stmt = stmt.where(Camera.enabled.is_(enabled))

    rows = db.execute(stmt.order_by(Lab.name, Camera.name)).all()
    return [_to_read(cam, lab_name) for cam, lab_name in rows]


@router.post(
    "",
    response_model=CameraRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a camera",
    description="Starts a worker for the camera immediately when it is enabled.",
)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)) -> CameraRead:
    lab = db.get(Lab, payload.lab_id)
    if lab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    camera = Camera(
        lab_id=payload.lab_id,
        name=payload.name,
        role=payload.role,
        rtsp_url=payload.rtsp_url,
        enabled=payload.enabled,
        status=CameraStatus.OFFLINE if payload.enabled else CameraStatus.DISABLED,
    )
    db.add(camera)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Laboratory '{lab.name}' already has a camera named '{payload.name}'.",
        ) from None

    db.refresh(camera)
    if camera.enabled:
        manager.restart(camera.id)
    return _to_read(camera, lab.name)


@router.get("/{camera_id}", response_model=CameraRead, summary="Get one camera")
def get_camera(camera_id: int, db: Session = Depends(get_db)) -> CameraRead:
    row = db.execute(
        select(Camera, Lab.name).join(Lab, Lab.id == Camera.lab_id).where(Camera.id == camera_id)
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")
    camera, lab_name = row
    return _to_read(camera, lab_name)


@router.patch(
    "/{camera_id}",
    response_model=CameraRead,
    summary="Update a camera",
    description="Restarts the camera's worker so the change takes effect at once.",
)
def update_camera(
    camera_id: int, payload: CameraUpdate, db: Session = Depends(get_db)
) -> CameraRead:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    data = payload.model_dump(exclude_unset=True)
    if "lab_id" in data and db.get(Lab, data["lab_id"]) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    for key, value in data.items():
        setattr(camera, key, value)
    if "enabled" in data and not data["enabled"]:
        camera.status = CameraStatus.DISABLED

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="That camera name is already used in this laboratory.",
        ) from None

    db.refresh(camera)
    manager.restart(camera.id)
    lab = db.get(Lab, camera.lab_id)
    return _to_read(camera, lab.name if lab else None)


@router.put(
    "/{camera_id}/zones",
    response_model=CameraRead,
    summary="Update zones for a camera",
)
def update_camera_zones(
    camera_id: int,
    zones: list[CameraZone],
    db: Session = Depends(get_db),
) -> CameraRead:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")
    camera.zones = [z.model_dump() for z in zones]
    db.commit()
    db.refresh(camera)
    lab = db.get(Lab, camera.lab_id)
    return _to_read(camera, lab.name if lab else None)


@router.delete(
    "/{camera_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a camera"
)
def delete_camera(camera_id: int, db: Session = Depends(get_db)) -> None:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")
    manager.stop_one(camera_id)
    db.delete(camera)
    db.commit()


@router.post(
    "/{camera_id}/test",
    response_model=CameraTestResult,
    summary="Test a camera by reading one frame",
)
def test_camera(camera_id: int, db: Session = Depends(get_db)) -> CameraTestResult:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")
    ok, info = probe_camera(camera.rtsp_url)
    return CameraTestResult(ok=ok, camera_id=camera_id, **info)


@router.post(
    "/{camera_id}/restart",
    response_model=CameraRead,
    summary="Restart a camera worker",
)
def restart_camera(camera_id: int, db: Session = Depends(get_db)) -> CameraRead:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")
    manager.restart(camera_id)
    db.refresh(camera)
    lab = db.get(Lab, camera.lab_id)
    return _to_read(camera, lab.name if lab else None)


def _mjpeg_frames(camera_id: int, camera_name: str) -> Iterator[bytes]:
    """Yield JPEG parts for multipart/x-mixed-replace."""
    interval = 1.0 / settings.stream_fps
    offline = _placeholder_jpeg(f"{camera_name}: offline")

    while True:
        started = time.monotonic()
        worker = manager.get(camera_id)
        frame = worker.buffer.get() if worker else None
        if frame is None:
            frame = offline

        yield (
            b"--" + BOUNDARY.encode() + b"\r\n"
            b"Content-Type: image/jpeg\r\n"
            b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
            + frame + b"\r\n"
        )

        elapsed = time.monotonic() - started
        if elapsed < interval:
            time.sleep(interval - elapsed)


@router.get(
    "/{camera_id}/stream.mjpeg",
    summary="Live MJPEG stream for one camera",
    description=(
        "Returns multipart/x-mixed-replace, which any browser can show directly "
        "in an <img> element. A camera with no picture streams an 'offline' frame "
        "instead of failing."
    ),
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"multipart/x-mixed-replace": {}},
            "description": "An endless stream of annotated JPEG frames.",
        }
    },
)
def stream_camera(camera_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    return StreamingResponse(
        _mjpeg_frames(camera.id, camera.name),
        media_type=f"multipart/x-mixed-replace; boundary={BOUNDARY}",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"},
    )


@router.get(
    "/{camera_id}/snapshot.jpg",
    summary="Single JPEG snapshot from a camera",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}}, "description": "One JPEG frame."}},
)
def snapshot(camera_id: int, db: Session = Depends(get_db)) -> Response:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    frame = manager.frame(camera_id) or _placeholder_jpeg(f"{camera.name}: offline")
    return Response(content=frame, media_type="image/jpeg", headers={"Cache-Control": "no-store"})
