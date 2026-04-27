"""Async SQLAlchemy engine + session. SQLite local, Postgres prod via DATABASE_URL."""
from __future__ import annotations

import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

_raw_db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./dev.db")
# Railway sets postgresql://, SQLAlchemy asyncpg needs postgresql+asyncpg://
if _raw_db_url.startswith("postgresql://"):
    _raw_db_url = _raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
DATABASE_URL = _raw_db_url

# echo=False here; Alembic logs migrations separately.
engine = create_async_engine(DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base. All ORM models inherit this."""


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency. Yields a session, closes on exit."""
    async with AsyncSessionLocal() as session:
        yield session
