FROM python:3.12-slim

WORKDIR /app

# System deps for asyncpg (C extension)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV PYTHONPATH=/app

# PORT is injected by Railway — do not hardcode
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
