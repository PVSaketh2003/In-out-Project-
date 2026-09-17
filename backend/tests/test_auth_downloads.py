"""
Unit & Integration Tests for Email OTP Authentication and Cross-Platform Downloads
"""
import time
import json
import pytest
from django.test import Client
from api.auth_views import _OTP_STORE, hash_otp


@pytest.fixture
def client():
    return Client()


@pytest.fixture(autouse=True)
def clean_otp_store():
    _OTP_STORE.clear()
    yield
    _OTP_STORE.clear()


@pytest.mark.django_db
def test_send_otp_success(client, monkeypatch):
    import api.auth_views
    monkeypatch.setattr(
        api.auth_views,
        "_get_smtp_credentials",
        lambda: ("smtp.gmail.com", 587, "test@example.com", "fake-smtp-password"),
    )
    from unittest.mock import MagicMock
    monkeypatch.setattr("django.core.mail.EmailMultiAlternatives.send", MagicMock(return_value=1))

    resp = client.post(
        "/api/auth/send-otp",
        data=json.dumps({"email": "testuser@example.com"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "sent"
    assert "testuser@example.com" in _OTP_STORE


@pytest.mark.django_db
def test_send_otp_invalid_email(client):
    resp = client.post(
        "/api/auth/send-otp",
        data=json.dumps({"email": "not-an-email"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "error" in resp.json()


@pytest.mark.django_db
def test_send_otp_cooldown(client):
    # First send
    client.post(
        "/api/auth/send-otp",
        data=json.dumps({"email": "cooldown@example.com"}),
        content_type="application/json",
    )

    # Immediate second send should trigger 429
    resp = client.post(
        "/api/auth/send-otp",
        data=json.dumps({"email": "cooldown@example.com"}),
        content_type="application/json",
    )
    assert resp.status_code == 429
    assert "retry_after" in resp.json()


@pytest.mark.django_db
def test_verify_otp_success(client):
    email = "authuser@example.com"
    otp = "654321"
    now = time.time()
    _OTP_STORE[email] = {
        "otp_hash": hash_otp(otp, email),
        "expires_at": now + 300,
        "attempts_left": 5,
        "last_sent_at": now,
    }

    resp = client.post(
        "/api/auth/verify-otp",
        data=json.dumps({"email": email, "otp": otp}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "authenticated"
    assert "token" in data
    # Verify OTP single-use: should be deleted from store
    assert email not in _OTP_STORE

    # Check session
    session_resp = client.get("/api/auth/session")
    assert session_resp.status_code == 200
    assert session_resp.json()["authenticated"] is True
    assert session_resp.json()["email"] == email


@pytest.mark.django_db
def test_verify_otp_invalid_code(client):
    email = "invalid@example.com"
    otp = "111222"
    now = time.time()
    _OTP_STORE[email] = {
        "otp_hash": hash_otp(otp, email),
        "expires_at": now + 300,
        "attempts_left": 5,
        "last_sent_at": now,
    }

    # Wrong code
    resp = client.post(
        "/api/auth/verify-otp",
        data=json.dumps({"email": email, "otp": "999999"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert resp.json()["attempts_left"] == 4


@pytest.mark.django_db
def test_verify_otp_expired(client):
    email = "expired@example.com"
    otp = "123123"
    _OTP_STORE[email] = {
        "otp_hash": hash_otp(otp, email),
        "expires_at": time.time() - 10,  # Expired 10s ago
        "attempts_left": 5,
        "last_sent_at": time.time() - 400,
    }

    resp = client.post(
        "/api/auth/verify-otp",
        data=json.dumps({"email": email, "otp": otp}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "expired" in resp.json()["error"].lower()


@pytest.mark.django_db
def test_logout(client):
    # Log in first
    email = "logoutuser@example.com"
    otp = "888888"
    _OTP_STORE[email] = {
        "otp_hash": hash_otp(otp, email),
        "expires_at": time.time() + 300,
        "attempts_left": 5,
        "last_sent_at": time.time(),
    }
    client.post(
        "/api/auth/verify-otp",
        data=json.dumps({"email": email, "otp": otp}),
        content_type="application/json",
    )

    # Verify session active
    assert client.get("/api/auth/session").json()["authenticated"] is True

    # Logout
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200

    # Verify session is cleared
    assert client.get("/api/auth/session").json()["authenticated"] is False


@pytest.mark.django_db
def test_downloads_info_endpoint(client):
    resp = client.get("/api/downloads/info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == "1.0.0"
    platforms = data["platforms"]
    assert "macos" in platforms
    assert "windows" in platforms
    assert "linux" in platforms
    assert "android" in platforms
    assert "ios" in platforms


@pytest.mark.django_db
def test_download_file_endpoints(client):
    # Test macOS download
    mac_resp = client.get("/api/downloads/macos")
    assert mac_resp.status_code == 200
    assert "attachment" in mac_resp.headers.get("Content-Disposition", "")

    # Test Windows download
    win_resp = client.get("/api/downloads/windows")
    assert win_resp.status_code == 200
    assert "VisionEye-Windows-x64.exe" in win_resp.headers.get("Content-Disposition", "")

    # Test Linux download
    linux_resp = client.get("/api/downloads/linux")
    assert linux_resp.status_code == 200
    assert "VisionEye-Linux-x64.AppImage" in linux_resp.headers.get("Content-Disposition", "")

    # Test Android download
    android_resp = client.get("/api/downloads/android")
    assert android_resp.status_code == 200
    assert "VisionEye-Android.apk" in android_resp.headers.get("Content-Disposition", "")

    # Test iOS download
    ios_resp = client.get("/api/downloads/ios")
    assert ios_resp.status_code == 200
    assert "VisionEye.mobileconfig" in ios_resp.headers.get("Content-Disposition", "")
