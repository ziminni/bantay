"""Nearest-neighbour search over enrolled face embeddings using pgvector."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import FaceEmbedding, Person


@dataclass(slots=True)
class MatchResult:
    """The closest enrolled person to a probe embedding."""

    person_id: int
    id_number: str
    full_name: str
    similarity: float


def find_closest(db: Session, embedding: np.ndarray) -> MatchResult | None:
    """Return the closest active enrolled person, or None when nobody is enrolled.

    Similarity is cosine similarity in ``[-1, 1]``, computed as
    ``1 - cosine_distance``. The HNSW index on ``face_embedding.embedding``
    makes this a single indexed query.
    """
    probe = np.asarray(embedding, dtype=np.float32).ravel().tolist()
    distance = FaceEmbedding.embedding.cosine_distance(probe).label("distance")

    row = db.execute(
        select(
            FaceEmbedding.person_id,
            Person.id_number,
            Person.full_name,
            distance,
        )
        .join(Person, Person.id == FaceEmbedding.person_id)
        .where(Person.active.is_(True))
        .order_by(distance)
        .limit(1)
    ).first()

    if row is None:
        return None

    person_id, id_number, full_name, dist = row
    return MatchResult(
        person_id=person_id,
        id_number=id_number,
        full_name=full_name,
        similarity=float(1.0 - float(dist)),
    )
