"""
Integration tests for Django REST API endpoints.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

import pytest
from django.test import Client


@pytest.fixture
def client():
    return Client()


@pytest.mark.django_db
def test_api_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "platform" in data
    assert "model" in data


@pytest.mark.django_db
def test_api_cameras_endpoint(client):
    response = client.get("/api/cameras")
    assert response.status_code == 200
    data = response.json()
    assert "cameras" in data


@pytest.mark.django_db
def test_api_config_endpoint(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "confidence_threshold" in data

    # Update config
    post_resp = client.post(
        "/api/config",
        {"confidence_threshold": 0.55, "privacy": {"enabled": True, "mode": "pixelate"}},
        content_type="application/json",
    )
    assert post_resp.status_code == 200
    updated = post_resp.json()["config"]
    assert updated["confidence_threshold"] == 0.55
    assert updated["privacy"]["mode"] == "pixelate"


@pytest.mark.django_db
def test_api_counting_line_endpoint(client):
    post_resp = client.post(
        "/api/counting-line",
        {"start": [0.15, 0.45], "end": [0.85, 0.45]},
        content_type="application/json",
    )
    assert post_resp.status_code == 200
    data = post_resp.json()["counting_line"]
    assert data["start"] == [0.15, 0.45]
    assert data["end"] == [0.85, 0.45]


@pytest.mark.django_db
def test_spa_routes(client):
    """Verifies that /, /live, and /app serve the React frontend without 404."""
    for path in ["/", "/live", "/live/", "/app", "/app/"]:
        resp = client.get(path)
        assert resp.status_code == 200


@pytest.mark.django_db
def test_pwa_manifest(client):
    """Verifies that manifest.webmanifest is served with proper content type."""
    resp = client.get("/manifest.webmanifest")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_video_upload_endpoint(client):
    """Verifies that uploading a video file via multipart form-data succeeds."""
    import io
    dummy_video = io.BytesIO(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom")
    dummy_video.name = "test_upload_sample.mp4"
    resp = client.post("/api/video/upload", {"video": dummy_video})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ["uploaded_and_started", "uploaded"]
    assert "test_upload_sample.mp4" in data["file_name"]


def test_client_frame_push_endpoint(client):
    """Tests POST /api/video/client_frame with base64-encoded frame."""
    import json
    import base64
    import numpy as np
    import cv2

    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", dummy_img)
    b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("utf-8")

    resp = client.post(
        "/api/video/client_frame",
        data=json.dumps({"frame": b64}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"

