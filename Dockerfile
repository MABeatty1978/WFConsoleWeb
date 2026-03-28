# Multi-stage build for WFConsoleWeb Docker image
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend source
COPY wfpiconsole/frontend /app/frontend

# Install dependencies and build
RUN npm install && \
    npm run build && \
    rm -rf node_modules

# Stage 2: Build Python runtime
FROM python:3.11-slim

LABEL maintainer="WFConsoleWeb Contributors"
LABEL description="Web interface for WeatherFlow Tempest weather station"
LABEL version="0.1.0"

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 wfconsole

WORKDIR /app

# Copy Python project
COPY --chown=wfconsole:wfconsole . /app/

# Copy built frontend from builder stage
COPY --from=frontend-builder --chown=wfconsole:wfconsole /app/frontend/build /app/wfpiconsole/backend/static

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel && \
    pip install -e .

# Create data directory
RUN mkdir -p /app/data && chown -R wfconsole:wfconsole /app/data

# Switch to non-root user
USER wfconsole

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Volume for persistence
VOLUME ["/app/data"]

# Start command
CMD ["wfpiconsole-web"]
