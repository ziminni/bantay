import io
from fastapi.testclient import TestClient
from bantay_backend.main import app

client = TestClient(app)


def test_create_and_get_enrollment_session():
    # 1. Create session
    resp = client.post("/api/v1/enrollment-sessions")
    assert resp.status_code == 201
    data = resp.json()
    assert "session_id" in data
    assert "network_ip" in data
    assert data["expires_in_seconds"] == 900
    session_id = data["session_id"]

    # 2. Get session status
    status_resp = client.get(f"/api/v1/enrollment-sessions/{session_id}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["session_id"] == session_id
    assert status_data["status"] == "pending"
    assert status_data["photo_count"] == 0
    assert status_data["photos"] == []


def test_upload_and_download_session_photos():
    # Create session
    resp = client.post("/api/v1/enrollment-sessions")
    session_id = resp.json()["session_id"]

    # Upload 2 dummy photos
    photo1 = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIFphoto1")
    photo2 = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIFphoto2")
    files = [
        ("files", ("selfie1.jpg", photo1, "image/jpeg")),
        ("files", ("selfie2.jpg", photo2, "image/jpeg")),
    ]

    up_resp = client.post(f"/api/v1/enrollment-sessions/{session_id}/photos", files=files)
    assert up_resp.status_code == 200
    up_data = up_resp.json()
    assert up_data["status"] == "received"
    assert up_data["photo_count"] == 2
    assert len(up_data["photos"]) == 2

    # Download photo 0
    dl_resp = client.get(f"/api/v1/enrollment-sessions/{session_id}/photos/0")
    assert dl_resp.status_code == 200
    assert dl_resp.content == b"\xff\xd8\xff\xe0\x00\x10JFIFphoto1"
    assert dl_resp.headers["content-type"] == "image/jpeg"

    # Close session
    del_resp = client.delete(f"/api/v1/enrollment-sessions/{session_id}")
    assert del_resp.status_code == 204

    # Verify 404 after deletion
    after_resp = client.get(f"/api/v1/enrollment-sessions/{session_id}")
    assert after_resp.status_code == 404
