"""
Tests for Resumable Chunked Video Upload & Counting Line Flip APIs
"""
import os
import io
import math
import hashlib
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from api.upload_views import upload_manager


@pytest.fixture(autouse=True)
def clean_upload_sessions():
    """Ensure clean upload sessions before each test."""
    upload_manager._sessions.clear()


def test_upload_init_success(client):
    """Verifies that initializing an upload session returns valid session metadata."""
    payload = {
        "file_name": "sample_pedestrians.mp4",
        "file_size": 15 * 1024 * 1024,  # 15 MB
        "chunk_size": 5 * 1024 * 1024,   # 5 MB
        "content_type": "video/mp4",
    }
    resp = client.post("/api/video/upload/init", payload, content_type="application/json")
    assert resp.status_code == 201
    data = resp.json()
    assert "upload_id" in data
    assert data["file_name"] == "sample_pedestrians.mp4"
    assert data["total_chunks"] == 3
    assert data["uploaded_chunks"] == []
    assert data["status"] == "initialized"


def test_upload_init_validation(client):
    """Verifies input validation on upload initialization."""
    # Missing file_name
    resp = client.post("/api/video/upload/init", {"file_size": 1000}, content_type="application/json")
    assert resp.status_code == 400

    # Negative / 0 file_size
    resp = client.post("/api/video/upload/init", {"file_name": "v.mp4", "file_size": 0}, content_type="application/json")
    assert resp.status_code == 400


def test_upload_chunk_and_status(client):
    """Verifies uploading individual chunks and checking session status."""
    # 1. Initialize
    init_resp = client.post("/api/video/upload/init", {
        "file_name": "traffic_test.mp4",
        "file_size": 600 * 1024,  # 600 KB
        "chunk_size": 200 * 1024,  # 200 KB => 3 chunks
    }, content_type="application/json")
    upload_id = init_resp.json()["upload_id"]

    # 2. Upload Chunk 0
    chunk0_data = b"A" * (200 * 1024)
    chunk0_hash = hashlib.sha256(chunk0_data).hexdigest()
    chunk0_file = SimpleUploadedFile("chunk_0.part", chunk0_data, content_type="application/octet-stream")

    resp0 = client.post("/api/video/upload/chunk", {
        "upload_id": upload_id,
        "chunk_index": 0,
        "chunk_hash": chunk0_hash,
        "chunk_file": chunk0_file,
    })
    assert resp0.status_code == 200
    assert resp0.json()["uploaded_count"] == 1

    # 3. Check Status
    status_resp = client.get(f"/api/video/upload/status/{upload_id}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["uploaded_chunks"] == [0]
    assert status_data["status"] == "uploading"


def test_upload_chunk_integrity_mismatch(client):
    """Verifies that corrupted chunks with hash mismatch are rejected."""
    init_resp = client.post("/api/video/upload/init", {
        "file_name": "corrupt_test.mp4",
        "file_size": 100 * 1024,
        "chunk_size": 100 * 1024,
    }, content_type="application/json")
    upload_id = init_resp.json()["upload_id"]

    chunk_data = b"REAL DATA"
    wrong_hash = "0000000000000000000000000000000000000000000000000000000000000000"
    chunk_file = SimpleUploadedFile("chunk.part", chunk_data, content_type="application/octet-stream")

    resp = client.post("/api/video/upload/chunk", {
        "upload_id": upload_id,
        "chunk_index": 0,
        "chunk_hash": wrong_hash,
        "chunk_file": chunk_file,
    })
    assert resp.status_code == 422


def test_upload_finalize_and_assembly(client):
    """Verifies that assembling all chunks succeeds and creates final file."""
    # 1. Init
    chunk_size = 100 * 1024
    total_size = 250 * 1024  # 3 chunks (100k, 100k, 50k)
    init_resp = client.post("/api/video/upload/init", {
        "file_name": "complete_video.mp4",
        "file_size": total_size,
        "chunk_size": chunk_size,
    }, content_type="application/json")
    upload_id = init_resp.json()["upload_id"]

    # 2. Upload 3 chunks
    parts = [b"1" * 102400, b"2" * 102400, b"3" * 51200]
    for idx, part_data in enumerate(parts):
        f = SimpleUploadedFile(f"chunk_{idx}.part", part_data)
        h = hashlib.sha256(part_data).hexdigest()
        c_resp = client.post("/api/video/upload/chunk", {
            "upload_id": upload_id,
            "chunk_index": idx,
            "chunk_hash": h,
            "chunk_file": f,
        })
        assert c_resp.status_code == 200

    # 3. Finalize
    fin_resp = client.post("/api/video/upload/finalize", {
        "upload_id": upload_id,
    }, content_type="application/json")
    assert fin_resp.status_code == 200
    fin_data = fin_resp.json()
    assert fin_data["status"] in ["uploaded_and_started", "uploaded"]
    assert os.path.exists(fin_data["file_path"])
    assert fin_data["size"] == total_size

    # 4. Idempotent second finalize call
    fin2_resp = client.post("/api/video/upload/finalize", {
        "upload_id": upload_id,
    }, content_type="application/json")
    assert fin2_resp.status_code == 200
    assert fin2_resp.json()["already_finalized"] is True


def test_upload_finalize_missing_chunks(client):
    """Verifies finalization fails if chunks are missing."""
    init_resp = client.post("/api/video/upload/init", {
        "file_name": "missing.mp4",
        "file_size": 200 * 1024,
        "chunk_size": 100 * 1024,
    }, content_type="application/json")
    upload_id = init_resp.json()["upload_id"]

    # Only upload chunk 0 of 2
    f = SimpleUploadedFile("chunk_0.part", b"A" * 102400)
    client.post("/api/video/upload/chunk", {
        "upload_id": upload_id,
        "chunk_index": 0,
        "chunk_file": f,
    })

    # Try finalize
    resp = client.post("/api/video/upload/finalize", {"upload_id": upload_id}, content_type="application/json")
    assert resp.status_code == 400
    assert "missing_chunks" in resp.json()


def test_upload_cancel(client):
    """Verifies cancelling an upload session."""
    init_resp = client.post("/api/video/upload/init", {
        "file_name": "cancel_me.mp4",
        "file_size": 100 * 1024,
    }, content_type="application/json")
    upload_id = init_resp.json()["upload_id"]

    cancel_resp = client.post("/api/video/upload/cancel", {"upload_id": upload_id}, content_type="application/json")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"

    # Status should now be cancelled
    status_resp = client.get(f"/api/video/upload/status/{upload_id}")
    assert status_resp.json()["status"] == "cancelled"


def test_counting_line_flip_endpoint(client):
    """Verifies atomic counting line flip (swapping Point A and Point B)."""
    # 1. Set initial line
    client.post("/api/counting-line", {
        "start": [0.10, 0.20],
        "end": [0.80, 0.90],
    }, content_type="application/json")

    # 2. Call flip endpoint
    flip_resp = client.post("/api/counting-line/flip", {"action": "flip"}, content_type="application/json")
    assert flip_resp.status_code == 200
    data = flip_resp.json()
    assert data["status"] == "flipped"
    # End became start, start became end
    assert data["counting_line"]["start"] == [0.80, 0.90]
    assert data["counting_line"]["end"] == [0.10, 0.20]

    # 3. Call flip again -> reverts to original
    flip2_resp = client.post("/api/counting-line/flip", {"action": "flip"}, content_type="application/json")
    assert flip2_resp.status_code == 200
    assert flip2_resp.json()["counting_line"]["start"] == [0.10, 0.20]
    assert flip2_resp.json()["counting_line"]["end"] == [0.80, 0.90]
