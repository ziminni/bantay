"""End-to-end checks against the HTTP API."""

from __future__ import annotations


def _make_lab(client, name="Lab 1", **kw):
    r = client.post("/api/v1/labs", json={"name": name, **kw})
    assert r.status_code == 201, r.text
    return r.json()


def _make_person(client, id_number="2021-00001", consent=True):
    r = client.post(
        "/api/v1/persons",
        json={
            "id_number": id_number,
            "full_name": "Juan Dela Cruz",
            "person_type": "STUDENT",
            "consent_given": consent,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


# -- documentation ------------------------------------------------------
def test_swagger_and_schema_are_served(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200

    schema = client.get("/openapi.json")
    assert schema.status_code == 200
    body = schema.json()
    assert body["info"]["title"] == "Bantay API"
    assert "/api/v1/entries" in body["paths"]


def test_root_redirects_to_docs(client):
    r = client.get("/", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers["location"] == "/docs"


def test_health_reports_the_database(client):
    body = client.get("/api/v1/health").json()
    assert body["database_reachable"] is True
    assert body["embedding_dim"] == 512


# -- labs ---------------------------------------------------------------
def test_lab_defaults_come_from_settings(client):
    lab = _make_lab(client)
    assert lab["match_threshold"] == 0.45
    assert lab["cooldown_seconds"] == 120
    assert lab["active"] is True


def test_duplicate_lab_name_is_rejected(client):
    _make_lab(client)
    assert client.post("/api/v1/labs", json={"name": "Lab 1"}).status_code == 409


def test_threshold_outside_zero_to_one_is_rejected(client):
    r = client.post("/api/v1/labs", json={"name": "Bad", "match_threshold": 1.4})
    assert r.status_code == 422


def test_lab_with_entries_cannot_be_deleted(client):
    lab = _make_lab(client)
    person = _make_person(client)
    client.post(
        "/api/v1/entries", json={"person_id": person["id"], "lab_id": lab["id"]}
    )
    r = client.delete(f"/api/v1/labs/{lab['id']}")
    assert r.status_code == 409


# -- persons ------------------------------------------------------------
def test_duplicate_id_number_is_rejected(client):
    _make_person(client)
    r = client.post(
        "/api/v1/persons",
        json={"id_number": "2021-00001", "full_name": "Someone Else"},
    )
    assert r.status_code == 409


def test_consent_timestamp_is_set_automatically(client):
    person = _make_person(client, consent=True)
    assert person["consent_given"] is True
    assert person["consent_signed_at"] is not None


def test_enrollment_without_consent_is_refused(client):
    person = _make_person(client, consent=False)
    r = client.post(
        f"/api/v1/persons/{person['id']}/faces",
        files=[("files", ("a.jpg", b"not-an-image", "image/jpeg"))],
    )
    # Consent is checked before the recognition engine is consulted.
    assert r.status_code == 403
    assert "consent" in r.json()["detail"].lower()


def test_person_search_matches_name_and_id_number(client):
    _make_person(client, "2021-11111")
    r = client.get("/api/v1/persons", params={"q": "Juan"})
    assert r.json()["total"] == 1
    r = client.get("/api/v1/persons", params={"q": "2021-111"})
    assert r.json()["total"] == 1
    r = client.get("/api/v1/persons", params={"q": "nobody"})
    assert r.json()["total"] == 0


# -- cameras ------------------------------------------------------------
def test_camera_password_is_masked_in_responses(client):
    lab = _make_lab(client)
    r = client.post(
        "/api/v1/cameras",
        json={
            "lab_id": lab["id"],
            "name": "Entrance",
            "role": "ENTRY",
            "rtsp_url": "rtsp://admin:supersecret@10.0.0.5:554/stream",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert "supersecret" not in body["rtsp_url"]
    assert body["rtsp_url"] == "rtsp://admin:****@10.0.0.5:554/stream"
    assert body["stream_url"].endswith("/stream.mjpeg")


def test_duplicate_camera_name_in_one_lab_is_rejected(client):
    lab = _make_lab(client)
    payload = {"lab_id": lab["id"], "name": "Entrance", "rtsp_url": "rtsp://x/1"}
    assert client.post("/api/v1/cameras", json=payload).status_code == 201
    assert client.post("/api/v1/cameras", json=payload).status_code == 409


def test_snapshot_returns_a_placeholder_when_offline(client):
    lab = _make_lab(client)
    cam = client.post(
        "/api/v1/cameras",
        json={"lab_id": lab["id"], "name": "Entrance", "rtsp_url": "rtsp://x/1"},
    ).json()
    r = client.get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert r.content[:2] == b"\xff\xd8"  # JPEG magic


# -- entries ------------------------------------------------------------
def test_manual_entry_then_cooldown(client):
    lab = _make_lab(client)
    person = _make_person(client)
    body = {"person_id": person["id"], "lab_id": lab["id"]}

    first = client.post("/api/v1/entries", json=body).json()
    second = client.post("/api/v1/entries", json=body).json()

    assert first["logged"] is True
    assert second["logged"] is False
    assert second["reason"] == "cooldown"


def test_entry_without_person_is_unknown(client):
    lab = _make_lab(client)
    r = client.post("/api/v1/entries", json={"lab_id": lab["id"]}).json()
    assert r["entry"]["status"] == "UNKNOWN"
    assert r["entry"]["person"] is None


def test_entries_are_filtered_and_paginated(client):
    lab = _make_lab(client)
    person = _make_person(client)
    for _ in range(3):
        client.post(
            "/api/v1/entries",
            json={"person_id": person["id"], "lab_id": lab["id"], "bypass_cooldown": True},
        )
    client.post("/api/v1/entries", json={"lab_id": lab["id"]})

    assert client.get("/api/v1/entries").json()["total"] == 4
    assert client.get("/api/v1/entries", params={"status": "UNKNOWN"}).json()["total"] == 1
    assert client.get("/api/v1/entries", params={"status": "MATCHED"}).json()["total"] == 3
    assert client.get("/api/v1/entries", params={"q": "Juan"}).json()["total"] == 3

    page = client.get("/api/v1/entries", params={"size": 2}).json()
    assert len(page["items"]) == 2
    assert page["pages"] == 2


def test_reversed_date_range_is_rejected(client):
    r = client.get(
        "/api/v1/entries",
        params={"date_from": "2026-12-01T00:00:00Z", "date_to": "2026-01-01T00:00:00Z"},
    )
    assert r.status_code == 422


def test_csv_export_has_a_header_and_rows(client):
    lab = _make_lab(client)
    person = _make_person(client)
    client.post("/api/v1/entries", json={"person_id": person["id"], "lab_id": lab["id"]})

    r = client.get("/api/v1/entries/export.csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("entry_id,entered_at_utc,status")
    assert "Juan Dela Cruz" in lines[1]


def test_unknown_ids_return_404(client):
    assert client.get("/api/v1/labs/999").status_code == 404
    assert client.get("/api/v1/persons/999").status_code == 404
    assert client.get("/api/v1/cameras/999").status_code == 404
    assert client.get("/api/v1/entries/999").status_code == 404


# -- dashboard ----------------------------------------------------------
def test_today_statistics(client):
    lab = _make_lab(client)
    person = _make_person(client)
    client.post("/api/v1/entries", json={"person_id": person["id"], "lab_id": lab["id"]})
    client.post("/api/v1/entries", json={"lab_id": lab["id"]})

    stats = client.get("/api/v1/stats/today").json()
    assert stats["entries_today"] == 2
    assert stats["distinct_persons_today"] == 1
    assert stats["unknown_today"] == 1
    assert len(stats["entries_per_hour"]) == 24
    assert stats["per_lab"][0]["count"] == 2
    assert len(stats["latest_entries"]) == 2


def test_recognition_endpoints_report_503_without_an_engine(client):
    lab = _make_lab(client)
    files = [("file", ("a.jpg", b"x", "image/jpeg"))]
    r = client.post(f"/api/v1/recognize/log?lab_id={lab['id']}", files=files)
    assert r.status_code == 503
