# Backend Dockerfile — Railway service Root Directory should be `backend/`
# Build context = backend/ (files copied relative to this Dockerfile).
FROM python:3.12-slim

WORKDIR /app

# System deps: gcc + libpq for asyncpg, curl for healthcheck debugging
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc libpq-dev curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first for layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

# Always-on: run alembic migrations on every boot, then start uvicorn.
# Railway sets $PORT. Workers=2 is enough for one small service.
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
