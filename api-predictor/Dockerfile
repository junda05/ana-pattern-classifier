# ANA Pattern Classifier - prediction service (CPU PyTorch).
# The model checkpoints in models/ are NOT copied into the image: mount them read-only at runtime:
#   docker run -v "$PWD/models:/app/models:ro" -e API_KEYS=... -p 8000:8000 <image>
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBUG=false

# OpenCV runtime libraries
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin app

WORKDIR /app

# Runtime dependencies only, at the pinned versions (CPU torch/torchvision from the PyTorch CPU index).
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY main.py ./
COPY app/ ./app/
RUN mkdir -p /app/models

# Ultralytics: settings in a writable dir (/tmp/Ultralytics) for the non-root user;
# no network probes or analytics
ENV YOLO_CONFIG_DIR=/tmp \
    YOLO_OFFLINE=true

USER app

EXPOSE 8000

# The checkpoints load at startup (about 15 s on CPU); /api/v1/health answers 503 until they are ready
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
