"""The entry rules: threshold, cooldown, and writing the entry log.

This is the heart of Bantay and deliberately small, matching the specification:

1. Find the closest enrolled embedding.
2. Accept it only when similarity is at or above the laboratory's threshold.
3. Suppress the entry when the same person was already logged in that
   laboratory within the cooldown period.
4. Otherwise write one row to ``entry_log``.

A face that does not reach the threshold is recorded once as an UNKNOWN entry.
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import (
    BehaviorFlag,
    Camera,
    EntryLog,
    EntryStatus,
    FlagStatus,
    FlagType,
    Lab,
)
from .matching import find_closest

logger = logging.getLogger(__name__)

Reason = str


@dataclass(slots=True)
class EntryOutcome:
    """What the rules decided for one face."""

    logged: bool
    reason: Reason
    entry: EntryLog | None = None
    similarity: float | None = None
    matched_person_id: int | None = None


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def in_cooldown(
    db: Session,
    person_id: int,
    lab_id: int,
    cooldown_seconds: int,
    now: dt.datetime | None = None,
) -> bool:
    """True when this person was already logged in this lab within the cooldown.

    The cooldown is per person and per laboratory, so one visit produces one
    entry even when the person lingers in front of the camera.
    """
    if cooldown_seconds <= 0:
        return False

    now = now or _utcnow()
    since = now - dt.timedelta(seconds=cooldown_seconds)

    recent = db.execute(
        select(EntryLog.id)
        .where(
            EntryLog.person_id == person_id,
            EntryLog.lab_id == lab_id,
            EntryLog.entered_at >= since,
        )
        .limit(1)
    ).first()
    return recent is not None


def save_snapshot(frame: np.ndarray | None, prefix: str = "unknown") -> str | None:
    """Write a JPEG snapshot of an unknown face and return its relative path."""
    if frame is None or not settings.store_unknown_snapshots:
        return None
    try:
        import cv2  # noqa: PLC0415 -- heavy import kept local

        root = Path(settings.media_root) / "snapshots"
        root.mkdir(parents=True, exist_ok=True)
        name = f"{prefix}_{_utcnow():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}.jpg"
        path = root / name
        cv2.imwrite(str(path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return f"snapshots/{name}"
    except Exception:
        logger.exception("Could not write the unknown-face snapshot.")
        return None


def record_entry(
    db: Session,
    *,
    lab: Lab,
    camera: Camera | None,
    embedding: np.ndarray,
    frame: np.ndarray | None = None,
    now: dt.datetime | None = None,
) -> EntryOutcome:
    """Apply the entry rules to one detected face and write the log if allowed."""
    now = now or _utcnow()

    if not lab.active:
        return EntryOutcome(logged=False, reason="lab_inactive")

    threshold = (
        lab.match_threshold
        if lab.match_threshold is not None
        else settings.default_match_threshold
    )
    cooldown = (
        lab.cooldown_seconds
        if lab.cooldown_seconds is not None
        else settings.default_cooldown_seconds
    )

    match = find_closest(db, embedding)

    # Nobody enrolled yet, or the closest face is too far away: unknown person.
    if match is None or match.similarity < threshold:
        similarity = match.similarity if match else None
        entry = EntryLog(
            person_id=None,
            lab_id=lab.id,
            camera_id=camera.id if camera else None,
            entered_at=now,
            similarity=similarity,
            status=EntryStatus.UNKNOWN,
            snapshot_path=save_snapshot(frame),
        )
        db.add(entry)
        db.flush()

        # Automatic behaviour flag: Unknown person entry
        unknown_flag = BehaviorFlag(
            type=FlagType.UNKNOWN_PERSON,
            status=FlagStatus.PENDING,
            occurred_at=now,
            lab_id=lab.id,
            camera_id=camera.id if camera else None,
            evidence={
                "rule_set": "Face",
                "metric": "Best similarity after voting",
                "value": round(float(similarity), 2) if similarity is not None else 0.0,
                "threshold": round(float(threshold), 2),
                "unit": "",
                "direction": "below",
                "held_seconds": None,
                "required_seconds": None,
                "track_id": None,
                "zone": "Door",
                "object": None,
            },
            snapshot_path=entry.snapshot_path,
            clip_path=None,
            trigger_offset=3.0,
            responsible_entry_ids=[],
        )
        db.add(unknown_flag)

        return EntryOutcome(
            logged=True,
            reason="below_threshold_unknown",
            entry=entry,
            similarity=similarity,
        )

    if in_cooldown(db, match.person_id, lab.id, cooldown, now=now):
        return EntryOutcome(
            logged=False,
            reason="cooldown",
            similarity=match.similarity,
            matched_person_id=match.person_id,
        )

    entry = EntryLog(
        person_id=match.person_id,
        lab_id=lab.id,
        camera_id=camera.id if camera else None,
        entered_at=now,
        similarity=match.similarity,
        status=EntryStatus.MATCHED,
    )
    db.add(entry)
    db.flush()

    # Check if entry happened outside lab schedule
    if lab.open_time and lab.close_time:
        entry_time = now.time()
        outside = False
        if lab.open_time <= lab.close_time:
            outside = not (lab.open_time <= entry_time <= lab.close_time)
        else:
            outside = not (entry_time >= lab.open_time or entry_time <= lab.close_time)
        if outside:
            unauthorized_flag = BehaviorFlag(
                type=FlagType.UNAUTHORIZED_USE,
                status=FlagStatus.PENDING,
                occurred_at=now,
                lab_id=lab.id,
                camera_id=camera.id if camera else None,
                evidence={
                    "rule_set": "Schedule",
                    "metric": "Entry outside lab hours",
                    "value": 1.0,
                    "threshold": 0.0,
                    "unit": "s",
                    "direction": "above",
                    "held_seconds": None,
                    "required_seconds": None,
                    "track_id": None,
                    "zone": lab.name,
                    "object": None,
                },
                snapshot_path=None,
                clip_path=None,
                trigger_offset=3.0,
                responsible_entry_ids=[],
            )
            db.add(unauthorized_flag)

    logger.info(
        "Entry logged: %s (%s) at %s via %s, similarity=%.3f",
        match.full_name,
        match.id_number,
        lab.name,
        camera.name if camera else "manual",
        match.similarity,
    )
    return EntryOutcome(
        logged=True,
        reason="logged",
        entry=entry,
        similarity=match.similarity,
        matched_person_id=match.person_id,
    )
