"""Tests for behaviour flags API and automatic behavior detection."""

from __future__ import annotations

import datetime as dt

import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from bantay_backend.models import BehaviorFlag, Camera, EntryLog, EntryStatus, FlagStatus, FlagType, Lab
from bantay_backend.services.entry_logging import record_entry


def _create_lab(client: TestClient, name: str = "CL-1") -> dict:
    resp = client.post(
        "/api/v1/labs",
        json={"name": name, "room": "Room 101", "match_threshold": 0.45, "cooldown_seconds": 120},
    )
    assert resp.status_code == 201
    return resp.json()


def test_flags_empty_and_list(client: TestClient):
    # Empty flags table returns empty list
    resp = client.get("/api/v1/flags")
    assert resp.status_code == 200
    assert resp.json() == []

    # Create a lab and a real flag
    lab = _create_lab(client, "Lab Alpha")
    payload = {
        "type": "UNKNOWN_PERSON",
        "lab_id": lab["id"],
        "evidence": {
            "rule_set": "Face",
            "metric": "Best similarity after voting",
            "value": 0.31,
            "threshold": 0.45,
            "unit": "",
            "direction": "below",
        },
    }
    create_resp = client.post("/api/v1/flags", json=payload)
    assert create_resp.status_code == 201

    resp = client.get("/api/v1/flags")
    assert resp.status_code == 200
    flags = resp.json()
    assert len(flags) == 1
    assert flags[0]["lab_id"] == lab["id"]
    assert flags[0]["type"] == "UNKNOWN_PERSON"


def test_flag_counts(client: TestClient):
    lab = _create_lab(client, "Lab Counts")
    # Initially 0
    resp = client.get("/api/v1/flags/counts")
    assert resp.status_code == 200
    counts = resp.json()
    assert counts == {"PENDING": 0, "CONFIRMED": 0, "DISMISSED": 0}

    # Add a flag
    payload = {
        "type": "UNKNOWN_PERSON",
        "lab_id": lab["id"],
        "evidence": {
            "rule_set": "Face",
            "metric": "Best similarity after voting",
            "value": 0.25,
            "threshold": 0.45,
            "direction": "below",
        },
    }
    client.post("/api/v1/flags", json=payload)
    counts = client.get("/api/v1/flags/counts").json()
    assert counts["PENDING"] == 1


def test_flag_review_and_reopen(client: TestClient):
    lab = _create_lab(client, "Lab Review")
    flag = client.post(
        "/api/v1/flags",
        json={
            "type": "UNKNOWN_PERSON",
            "lab_id": lab["id"],
            "evidence": {
                "rule_set": "Face",
                "metric": "Best similarity after voting",
                "value": 0.2,
                "threshold": 0.45,
                "direction": "below",
            },
        },
    ).json()

    # Review flag: CONFIRMED
    resp = client.patch(
        f"/api/v1/flags/{flag['id']}",
        json={"status": "CONFIRMED", "note": "Unidentified visitor.", "responsible_entry_ids": []},
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["status"] == "CONFIRMED"
    assert updated["review_note"] == "Unidentified visitor."
    assert updated["reviewed_by"] is not None
    assert updated["reviewed_at"] is not None

    # Reopen flag back to PENDING
    reopen_resp = client.post(f"/api/v1/flags/{flag['id']}/reopen")
    assert reopen_resp.status_code == 200
    reopened = reopen_resp.json()
    assert reopened["status"] == "PENDING"
    assert reopened["reviewed_by"] is None


def test_create_custom_flag(client: TestClient):
    lab = _create_lab(client, "Lab Custom")
    payload = {
        "type": "EQUIPMENT_REMOVAL",
        "lab_id": lab["id"],
        "evidence": {
            "rule_set": "Object",
            "metric": "Missing since last wrist contact",
            "value": 45.0,
            "threshold": 30.0,
            "unit": "s",
            "direction": "above",
            "held_seconds": 45.0,
            "required_seconds": 30.0,
            "track_id": 1,
            "zone": "Station 4",
            "object": "monitor cable",
        },
        "trigger_offset": 2.5,
    }
    resp = client.post("/api/v1/flags", json=payload)
    assert resp.status_code == 201
    flag = resp.json()
    assert flag["type"] == "EQUIPMENT_REMOVAL"
    assert flag["status"] == "PENDING"
    assert flag["evidence"]["metric"] == "Missing since last wrist contact"


def test_automatic_flag_on_unknown_entry(client: TestClient, db: Session, rng):
    lab_data = _create_lab(client, "Lab AutoFlag")
    lab = db.get(Lab, lab_data["id"])

    # Random embedding with zero enrolled persons will result in unknown person
    random_emb = rng.standard_normal(512).astype(np.float32)
    random_emb /= np.linalg.norm(random_emb)

    outcome = record_entry(db, lab=lab, camera=None, embedding=random_emb)
    assert outcome.logged is True
    assert outcome.reason == "below_threshold_unknown"
    db.commit()

    # Verify a BehaviorFlag of type UNKNOWN_PERSON was created
    flags = client.get(f"/api/v1/flags?lab_id={lab.id}&type=UNKNOWN_PERSON").json()
    assert len(flags) >= 1
    recent = flags[0]
    assert recent["type"] == "UNKNOWN_PERSON"
    assert recent["status"] == "PENDING"
    assert recent["evidence"]["direction"] == "below"
