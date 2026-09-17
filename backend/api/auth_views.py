"""
VisionEye Email OTP Authentication Views
Implements secure 6-digit OTP verification via pvsaketh1@gmail.com
"""
import re
import time
import secrets
import hashlib
import hmac
import logging
from django.conf import settings
from django.core.mail import send_mail
from django.core import signing
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger("visioneye.auth")

# In-memory secure OTP store
# Structure: { email: { "otp_hash": str, "expires_at": float, "attempts_left": int, "last_sent_at": float } }
_OTP_STORE = {}

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def _get_otp_secret():
    return getattr(settings, "OTP_SECRET", "visioneye-otp-secret-salt-key-83921")


def hash_otp(otp: str, email: str) -> str:
    """Generate SHA-256 hash with email and secret salt (never store plain OTP)."""
    salt = _get_otp_secret()
    payload = f"{email.lower().strip()}:{otp.strip()}:{salt}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def generate_session_token(email: str) -> str:
    """Generate tamper-proof signed session token."""
    return signing.dumps({"email": email.lower().strip(), "auth": True, "created_at": time.time()})


def verify_session_token(token: str) -> dict:
    """Validate signed session token."""
    try:
        data = signing.loads(token, max_age=86400 * 7)  # 7 days validity
        if data.get("auth") and data.get("email"):
            return data
    except Exception:
        pass
    return None


def is_request_authenticated(request) -> tuple[bool, str]:
    """Check if incoming request has valid session cookie or Bearer token."""
    # Check Django session first
    if request.session.get("is_authenticated") and request.session.get("auth_email"):
        return True, request.session.get("auth_email")

    # Check Authorization header (for mobile/desktop API clients)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        data = verify_session_token(token)
        if data:
            return True, data["email"]

    return False, ""


class SendOTPView(APIView):
    """
    Generate and email 6-digit OTP to user's email.
    POST /api/auth/send-otp
    Body: {"email": "user@example.com"}
    """

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email or not EMAIL_REGEX.match(email):
            return Response(
                {"error": "Please provide a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = time.time()
        record = _OTP_STORE.get(email)

        # 30-second resend cooldown protection
        if record:
            time_since_last = now - record.get("last_sent_at", 0)
            if time_since_last < 30:
                retry_after = int(30 - time_since_last)
                return Response(
                    {
                        "error": f"Please wait {retry_after}s before requesting a new code.",
                        "retry_after": retry_after,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        # Generate cryptographically secure 6-digit numeric OTP
        otp = f"{secrets.randbelow(900000) + 100000}"
        otp_hash = hash_otp(otp, email)

        # 5-minute expiry, 5 allowed verification attempts
        _OTP_STORE[email] = {
            "otp_hash": otp_hash,
            "expires_at": now + 300,  # 5 minutes
            "attempts_left": 5,
            "last_sent_at": now,
        }

        # Compose email
        subject = "VisionEye Verification Code"
        body = (
            f"Your verification code is:\n\n"
            f"{otp}\n\n"
            f"This code expires in 5 minutes.\n\n"
            f"If you did not request this code, you can ignore this email."
        )
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "VisionEye <pvsaketh1@gmail.com>")

        email_sent = False
        smtp_password = getattr(settings, "EMAIL_HOST_PASSWORD", "")

        if smtp_password:
            try:
                send_mail(
                    subject=subject,
                    message=body,
                    from_email=from_email,
                    recipient_list=[email],
                    fail_silently=False,
                )
                email_sent = True
                logger.info(f"Successfully sent OTP email to {email}")
            except Exception as e:
                logger.error(f"Failed to send email via SMTP to {email}: {e}")

        if not email_sent:
            # Fallback for dev / staging before SMTP password is populated in .env
            logger.info(f"[AUTH DEV LOG] Generated OTP for {email}: {otp}")

        resp_data = {
            "status": "sent",
            "message": f"Verification code sent to {email}",
            "expires_in": 300,
        }

        # If in debug mode or SMTP not configured, include dev notice
        if getattr(settings, "DEBUG", False) and not smtp_password:
            resp_data["dev_code"] = otp

        return Response(resp_data, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    """
    Verify 6-digit OTP and create authenticated session.
    POST /api/auth/verify-otp
    Body: {"email": "user@example.com", "otp": "123456"}
    """

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = str(request.data.get("otp", "")).strip()

        if not email or not otp:
            return Response(
                {"error": "Email and 6-digit verification code are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = time.time()
        record = _OTP_STORE.get(email)

        if not record:
            return Response(
                {"error": "No verification code requested or code expired. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check expiration (5 minutes)
        if now > record["expires_at"]:
            _OTP_STORE.pop(email, None)
            return Response(
                {"error": "Verification code has expired. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check attempt limits
        if record["attempts_left"] <= 0:
            _OTP_STORE.pop(email, None)
            return Response(
                {"error": "Maximum verification attempts exceeded. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Secure constant-time hash comparison
        computed_hash = hash_otp(otp, email)
        if not hmac.compare_digest(computed_hash, record["otp_hash"]):
            record["attempts_left"] -= 1
            attempts_left = record["attempts_left"]
            if attempts_left <= 0:
                _OTP_STORE.pop(email, None)
                return Response(
                    {"error": "Invalid verification code. Maximum attempts reached. Please request a new code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {
                    "error": f"Invalid verification code. {attempts_left} attempt{'s' if attempts_left > 1 else ''} remaining.",
                    "attempts_left": attempts_left,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verification succeeded: Single-use invalidation
        _OTP_STORE.pop(email, None)

        # Create session
        request.session["is_authenticated"] = True
        request.session["auth_email"] = email
        request.session.save()

        token = generate_session_token(email)

        logger.info(f"User {email} authenticated successfully")
        return Response(
            {
                "status": "authenticated",
                "email": email,
                "token": token,
                "message": "Authentication successful.",
            },
            status=status.HTTP_200_OK,
        )


class SessionStatusView(APIView):
    """
    Check current authentication session status.
    GET /api/auth/session
    """

    def get(self, request):
        is_auth, email = is_request_authenticated(request)
        return Response({
            "authenticated": is_auth,
            "email": email if is_auth else None,
        })


class LogoutView(APIView):
    """
    Log out user and invalidate session.
    POST /api/auth/logout
    """

    def post(self, request):
        request.session.flush()
        return Response({"status": "logged_out", "message": "Logged out successfully."})
