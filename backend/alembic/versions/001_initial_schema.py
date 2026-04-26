"""initial schema: videos, segments, jobs, glossary

Revision ID: 001
Revises:
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "videos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("youtube_id", sa.String(20), nullable=False, unique=True),
        sa.Column("title", sa.String(500)),
        sa.Column("channel", sa.String(200)),
        sa.Column("duration_s", sa.Integer()),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("fetched_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_videos_youtube_id", "videos", ["youtube_id"])
    op.create_index("ix_videos_status", "videos", ["status"])

    op.create_table(
        "segments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("video_id", sa.Integer(), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("segment_index", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Float(), nullable=False),
        sa.Column("duration", sa.Float(), nullable=False),
        sa.Column("te_original", sa.Text(), nullable=False),
        sa.Column("en_auto", sa.Text()),
        sa.Column("en_human", sa.Text()),
        sa.Column("en_final", sa.Text()),
        sa.Column("content_type", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("is_reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("quality_score", sa.Integer()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_segments_video_id", "segments", ["video_id"])
    op.create_index("ix_segments_content_type", "segments", ["content_type"])
    op.create_index("ix_segments_is_reviewed", "segments", ["is_reviewed"])

    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("video_id", sa.Integer(), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("error_msg", sa.Text()),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("finished_at", sa.DateTime()),
    )
    op.create_index("ix_jobs_video_id", "jobs", ["video_id"])
    op.create_index("ix_jobs_status", "jobs", ["status"])

    op.create_table(
        "glossary",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("te_term", sa.String(200), nullable=False, unique=True),
        sa.Column("en_term", sa.String(200), nullable=False),
        sa.Column("category", sa.String(20), nullable=False, server_default="general"),
        sa.Column("notes", sa.Text()),
    )
    op.create_index("ix_glossary_te_term", "glossary", ["te_term"])
    op.create_index("ix_glossary_category", "glossary", ["category"])


def downgrade() -> None:
    op.drop_table("glossary")
    op.drop_table("jobs")
    op.drop_table("segments")
    op.drop_table("videos")
