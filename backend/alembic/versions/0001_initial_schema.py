"""Initial Bantay schema: persons, face embeddings, labs, cameras, entry logs.

Revision ID: 0001
Revises:
Create Date: 2026-11-23
"""

from __future__ import annotations

import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

EMBEDDING_DIM = 512


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "person",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("id_number", sa.String(32), nullable=False),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("person_type", sa.String(16), nullable=False, server_default="STUDENT"),
        sa.Column("department", sa.String(120), nullable=True),
        sa.Column("consent_given", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("consent_signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "person_type IN ('STUDENT','FACULTY','STAFF')", name="ck_person_type"
        ),
        sa.UniqueConstraint("id_number", name="uq_person_id_number"),
    )
    op.create_index("ix_person_id_number", "person", ["id_number"])
    op.create_index("ix_person_full_name", "person", ["full_name"])
    op.create_index("ix_person_active", "person", ["active"])

    op.create_table(
        "lab",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("room", sa.String(80), nullable=True),
        sa.Column("open_time", sa.Time(), nullable=True),
        sa.Column("close_time", sa.Time(), nullable=True),
        sa.Column("match_threshold", sa.Float(), nullable=False, server_default="0.45"),
        sa.Column("cooldown_seconds", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "match_threshold >= 0 AND match_threshold <= 1", name="ck_lab_threshold_range"
        ),
        sa.CheckConstraint("cooldown_seconds >= 0", name="ck_lab_cooldown_nonneg"),
        sa.UniqueConstraint("name", name="uq_lab_name"),
    )
    op.create_index("ix_lab_name", "lab", ["name"])
    op.create_index("ix_lab_active", "lab", ["active"])

    op.create_table(
        "face_embedding",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(EMBEDDING_DIM), nullable=False),
        sa.Column("det_score", sa.Float(), nullable=True),
        sa.Column("source_filename", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["person_id"], ["person.id"], ondelete="CASCADE", name="fk_face_embedding_person"
        ),
    )
    op.create_index("ix_face_embedding_person_id", "face_embedding", ["person_id"])
    # Approximate nearest neighbour search on cosine distance.
    op.create_index(
        "ix_face_embedding_vector",
        "face_embedding",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "camera",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lab_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="ENTRY"),
        sa.Column("rtsp_url", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(16), nullable=False, server_default="OFFLINE"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('ENTRY','ROOM')", name="ck_camera_role"),
        sa.CheckConstraint(
            "status IN ('ONLINE','OFFLINE','DISABLED')", name="ck_camera_status"
        ),
        sa.ForeignKeyConstraint(
            ["lab_id"], ["lab.id"], ondelete="CASCADE", name="fk_camera_lab"
        ),
    )
    op.create_index("ix_camera_lab_id", "camera", ["lab_id"])
    op.create_index("ix_camera_enabled", "camera", ["enabled"])
    op.create_index("ix_camera_lab_name", "camera", ["lab_id", "name"], unique=True)

    op.create_table(
        "entry_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("person_id", sa.Integer(), nullable=True),
        sa.Column("lab_id", sa.Integer(), nullable=False),
        sa.Column("camera_id", sa.Integer(), nullable=True),
        sa.Column("entered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("similarity", sa.Float(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="MATCHED"),
        sa.Column("snapshot_path", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('MATCHED','UNKNOWN')", name="ck_entry_status"),
        sa.ForeignKeyConstraint(
            ["person_id"], ["person.id"], ondelete="SET NULL", name="fk_entry_person"
        ),
        sa.ForeignKeyConstraint(
            ["lab_id"], ["lab.id"], ondelete="RESTRICT", name="fk_entry_lab"
        ),
        sa.ForeignKeyConstraint(
            ["camera_id"], ["camera.id"], ondelete="SET NULL", name="fk_entry_camera"
        ),
    )
    op.create_index("ix_entry_log_person_id", "entry_log", ["person_id"])
    op.create_index("ix_entry_log_lab_id", "entry_log", ["lab_id"])
    op.create_index("ix_entry_log_camera_id", "entry_log", ["camera_id"])
    op.create_index("ix_entry_log_entered_at", "entry_log", ["entered_at"])
    op.create_index("ix_entry_log_lab_entered", "entry_log", ["lab_id", "entered_at"])
    op.create_index("ix_entry_log_person_entered", "entry_log", ["person_id", "entered_at"])


def downgrade() -> None:
    op.drop_table("entry_log")
    op.drop_table("camera")
    op.drop_index("ix_face_embedding_vector", table_name="face_embedding")
    op.drop_table("face_embedding")
    op.drop_table("lab")
    op.drop_table("person")
