"""ORM models — schema is canonical in project-settings.md.

Tables: videos, segments, jobs, glossary.
en_final = en_human if set, else en_auto (computed at read time).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    youtube_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String(500))
    channel: Mapped[str | None] = mapped_column(String(200))
    duration_s: Mapped[int | None] = mapped_column(Integer)
    # status: pending | fetching | fetched | no_transcript | error
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    segments: Mapped[list["Segment"]] = relationship(back_populates="video", cascade="all, delete-orphan")
    jobs: Mapped[list["Job"]] = relationship(back_populates="video", cascade="all, delete-orphan")


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True, nullable=False)
    segment_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)

    te_original: Mapped[str] = mapped_column(Text, nullable=False)
    en_auto: Mapped[str | None] = mapped_column(Text)
    en_human: Mapped[str | None] = mapped_column(Text)
    # en_final is computed: en_human if set else en_auto. Stored as a column for export speed.
    en_final: Mapped[str | None] = mapped_column(Text)

    # content_type: sermon | song | prayer | unknown
    content_type: Mapped[str] = mapped_column(String(20), default="unknown", nullable=False, index=True)
    is_reviewed: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    quality_score: Mapped[int | None] = mapped_column(Integer)  # 1-5
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    video: Mapped["Video"] = relationship(back_populates="segments")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True, nullable=False)
    # status: queued | running | done | failed
    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False, index=True)
    error_msg: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)

    video: Mapped["Video"] = relationship(back_populates="jobs")


class GlossaryTerm(Base):
    __tablename__ = "glossary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    te_term: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    en_term: Mapped[str] = mapped_column(String(200), nullable=False)
    # category: theology | name | place | general
    category: Mapped[str] = mapped_column(String(20), default="general", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
