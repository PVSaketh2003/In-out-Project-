# ==============================================================================
# VisionEye Real-Time Foot-Traffic Analytics - Production Multi-Stage Dockerfile
# Stage 1: Build React/Vite Frontend
# Stage 2: Production Python Backend with Daphne ASGI & OpenCV / ONNX Runtime
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend SPA Build
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --prefer-offline --no-audit

COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime Environment
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000 \
    MODEL_PATH=/app/backend/models/yolo26n.onnx \
    CONFIDENCE_THRESHOLD=0.40 \
    DJANGO_SETTINGS_MODULE=config.settings \
    PYTHONPATH=/app/backend

WORKDIR /app

# Install system runtime libraries for OpenCV, GL, and networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/
COPY pytest.ini ./.env.example ./

# Copy built frontend SPA assets to static root
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure models directory exists with YOLO26n ONNX model
RUN mkdir -p /app/backend/models /app/backend/media/uploads /app/backend/data
RUN python -c "from models.setup_model import create_yolo26n_onnx_model; import os; os.path.exists('/app/backend/models/yolo26n.onnx') or create_yolo26n_onnx_model('/app/backend/models/yolo26n.onnx')"

# Apply migrations on build/startup preparation
RUN cd backend && python manage.py migrate --noinput

EXPOSE 8000

# Healthcheck for container orchestrators (Azure VM / Docker Compose / Kubernetes)
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/api/health || exit 1

# Launch production Daphne ASGI server
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "--application-close-timeout", "10", "config.asgi:application"]
