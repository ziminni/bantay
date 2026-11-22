"""The entry rules: threshold, cooldown, unknown capture."""

from __future__ import annotations

import datetime as dt

import numpy as np
import pytest

from bantay_backend.models import EntryStatus, FaceEmbedding, Lab, Person
from bantay_backend.services.entry_logging import in_cooldown, record_entry
from bantay_backend.services.matching import find_closest
from bantay_backend.services.recognition import l2_normalize


@pytest.fixture
def lab(db):
    lab = Lab(name="Lab 1", match_threshold=0.45, cooldown_seconds=120)
    db.add(lab)
    db.commit()
    db.refresh(lab)
    return lab


@pytest.fixture
def enrolled(db, embedding):
    person = Person(
        id_number="2021-00001",
        full_name="Juan Dela Cruz",
        consent_given=True,
    )
    db.add(person)
    db.flush()
    base = embedding(7)
    db.add(FaceEmbedding(person_id=person.id, embedding=base.tolist(), det_score=0.9))
    db.commit()
    db.refresh(person)
    return person, base


def _noisy(vec: np.ndarray, scale: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return l2_normalize(vec + scale * rng.normal(size=vec.shape).astype(np.float32))


def test_find_closest_returns_none_when_nobody_enrolled(db, embedding):
    assert find_closest(db, embedding(1)) is None


def test_similar_face_scores_higher_than_unrelated(db, enrolled, embedding):
    _, base = enrolled
    # Noise is spread over 512 dimensions, so a small per-component scale still
    # moves the vector a long way: 0.01 here stands for 'the same face again'.
    near = find_closest(db, _noisy(base, 0.01, 1))
    far = find_closest(db, embedding(99))
    assert near.similarity > 0.9
    assert far.similarity < 0.3
    assert near.similarity > far.similarity


def test_match_above_threshold_is_logged(db, lab, enrolled):
    person, base = enrolled
    outcome = record_entry(db, lab=lab, camera=None, embedding=_noisy(base, 0.05, 2))
    db.commit()

    assert outcome.logged is True
    assert outcome.reason == "logged"
    assert outcome.entry.status == EntryStatus.MATCHED
    assert outcome.entry.person_id == person.id
    assert outcome.similarity >= lab.match_threshold


def test_face_below_threshold_is_recorded_as_unknown(db, lab, enrolled, embedding):
    outcome = record_entry(db, lab=lab, camera=None, embedding=embedding(99))

    assert outcome.logged is True
    assert outcome.reason == "below_threshold_unknown"
    assert outcome.entry.status == EntryStatus.UNKNOWN
    assert outcome.entry.person_id is None


def test_cooldown_suppresses_a_second_entry(db, lab, enrolled):
    probe = _noisy(enrolled[1], 0.05, 3)

    first = record_entry(db, lab=lab, camera=None, embedding=probe)
    db.commit()
    second = record_entry(db, lab=lab, camera=None, embedding=probe)
    db.commit()

    assert first.logged is True
    assert second.logged is False
    assert second.reason == "cooldown"


def test_entry_is_logged_again_after_the_cooldown_expires(db, lab, enrolled):
    probe = _noisy(enrolled[1], 0.05, 4)
    now = dt.datetime.now(dt.UTC)

    record_entry(db, lab=lab, camera=None, embedding=probe, now=now)
    db.commit()
    later = record_entry(
        db,
        lab=lab,
        camera=None,
        embedding=probe,
        now=now + dt.timedelta(seconds=lab.cooldown_seconds + 1),
    )
    db.commit()

    assert later.logged is True
    assert later.reason == "logged"


def test_cooldown_is_per_laboratory(db, lab, enrolled):
    other = Lab(name="Lab 2", match_threshold=0.45, cooldown_seconds=120)
    db.add(other)
    db.commit()
    db.refresh(other)

    probe = _noisy(enrolled[1], 0.05, 5)
    first = record_entry(db, lab=lab, camera=None, embedding=probe)
    db.commit()
    second = record_entry(db, lab=other, camera=None, embedding=probe)
    db.commit()

    # Walking into a different laboratory is a different entry.
    assert first.logged is True
    assert second.logged is True


def test_zero_cooldown_never_suppresses(db, enrolled):
    lab = Lab(name="Lab 3", match_threshold=0.45, cooldown_seconds=0)
    db.add(lab)
    db.commit()
    db.refresh(lab)

    probe = _noisy(enrolled[1], 0.05, 6)
    assert record_entry(db, lab=lab, camera=None, embedding=probe).logged is True
    db.commit()
    assert record_entry(db, lab=lab, camera=None, embedding=probe).logged is True
    db.commit()
    assert in_cooldown(db, enrolled[0].id, lab.id, 0) is False


def test_inactive_lab_logs_nothing(db, lab, enrolled):
    lab.active = False
    db.commit()
    outcome = record_entry(db, lab=lab, camera=None, embedding=_noisy(enrolled[1], 0.05, 8))
    assert outcome.logged is False
    assert outcome.reason == "lab_inactive"


def test_inactive_person_is_not_matched(db, lab, enrolled):
    person, base = enrolled
    person.active = False
    db.commit()

    outcome = record_entry(db, lab=lab, camera=None, embedding=_noisy(base, 0.05, 9))
    assert outcome.entry.status == EntryStatus.UNKNOWN


def test_higher_threshold_rejects_a_noisy_match(db, enrolled):
    strict = Lab(name="Lab Strict", match_threshold=0.99, cooldown_seconds=120)
    db.add(strict)
    db.commit()
    db.refresh(strict)

    outcome = record_entry(db, lab=strict, camera=None, embedding=_noisy(enrolled[1], 0.3, 10))
    assert outcome.reason == "below_threshold_unknown"
