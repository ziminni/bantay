"""The dashboard's day must follow local time, not UTC.

The department is at UTC+8, so a UTC-based "today" would roll over at 08:00
local time and show the wrong figures for the first eight hours of every day.
"""

from __future__ import annotations

import datetime as dt

import pytest

from bantay_backend.config import settings
from bantay_backend.models import EntryLog, EntryStatus, Lab, Person


@pytest.fixture
def lab(db):
    lab = Lab(name="Lab 1")
    db.add(lab)
    db.commit()
    db.refresh(lab)
    return lab


@pytest.fixture
def person(db):
    person = Person(id_number="2021-00001", full_name="Juan Dela Cruz", consent_given=True)
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


def _local_midnight() -> dt.datetime:
    now_local = dt.datetime.now(settings.tzinfo)
    return now_local.replace(hour=0, minute=0, second=0, microsecond=0)


def _add_entry(db, lab, person, when_local: dt.datetime) -> None:
    db.add(
        EntryLog(
            person_id=person.id,
            lab_id=lab.id,
            entered_at=when_local.astimezone(dt.UTC),
            status=EntryStatus.MATCHED,
            similarity=0.8,
        )
    )
    db.commit()


def test_timezone_is_configured_for_the_philippines():
    assert settings.timezone == "Asia/Manila"
    offset = dt.datetime.now(settings.tzinfo).utcoffset()
    assert offset == dt.timedelta(hours=8)


def test_entry_just_after_local_midnight_counts_as_today(client, db, lab, person):
    midnight = _local_midnight()
    # 00:30 local is still the previous day in UTC, which is the whole point.
    _add_entry(db, lab, person, midnight + dt.timedelta(minutes=30))

    stats = client.get("/api/v1/stats/today").json()
    assert stats["entries_today"] == 1
    assert stats["date"] == midnight.date().isoformat()


def test_entry_before_local_midnight_does_not_count_as_today(client, db, lab, person):
    midnight = _local_midnight()
    _add_entry(db, lab, person, midnight - dt.timedelta(minutes=30))

    stats = client.get("/api/v1/stats/today").json()
    assert stats["entries_today"] == 0


def test_only_todays_entries_are_counted(client, db, lab, person):
    midnight = _local_midnight()
    _add_entry(db, lab, person, midnight - dt.timedelta(hours=2))   # yesterday
    _add_entry(db, lab, person, midnight + dt.timedelta(minutes=10))  # today
    _add_entry(db, lab, person, midnight + dt.timedelta(minutes=20))  # today

    stats = client.get("/api/v1/stats/today").json()
    assert stats["entries_today"] == 2


def test_hour_buckets_use_local_hours(client, db, lab, person):
    midnight = _local_midnight()
    _add_entry(db, lab, person, midnight + dt.timedelta(hours=9, minutes=15))

    stats = client.get("/api/v1/stats/today").json()
    buckets = {b["hour"]: b["count"] for b in stats["entries_per_hour"]}
    assert len(stats["entries_per_hour"]) == 24
    # 09:15 local, not 01:15 UTC.
    assert buckets[9] == 1
    assert buckets[1] == 0


def test_the_reported_date_is_the_local_date(client):
    stats = client.get("/api/v1/stats/today").json()
    assert stats["date"] == dt.datetime.now(settings.tzinfo).date().isoformat()
