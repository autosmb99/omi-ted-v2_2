"""Async SQLAlchemy engine + session. SQLite local, Postgres prod via DATABASE_URL."""
from __future__ import annotations

import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./dev.db")

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
