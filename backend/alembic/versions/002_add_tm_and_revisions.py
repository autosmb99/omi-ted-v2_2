"""Add translation_memory and segment_revisions tables.

Revision ID: 002
Revises: 001
Create Date: 2026-05-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "translation_memory",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("te_text", sa.Text(), nullable=False, index=True),
        sa.Column("en_text", sa.Text(), nullable=False),
        sa.Column("source_video_id", sa.Integer(), sa.ForeignKey("videos.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_segment_id", sa.Integer(), sa.ForeignKey("segments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "segment_revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("segment_id", sa.Integer(), sa.ForeignKey("segments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("en_human_before", sa.Text(), nullable=True),
        sa.Column("en_human_after", sa.Text(), nullable=False),
        sa.Column("editor_name", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("segment_revisions")
    op.drop_table("translation_memory")
