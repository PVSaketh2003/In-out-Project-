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


def _get_smtp_credentials():
    """Retrieve SMTP credentials dynamically from settings, environment, or .env files."""
    import os
    from pathlib import Path
    host = os.getenv("SMTP_HOST") or getattr(settings, "EMAIL_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT") or getattr(settings, "EMAIL_PORT", 587))
    user = os.getenv("SMTP_USER") or getattr(settings, "EMAIL_HOST_USER", "pvsaketh1@gmail.com")
    password = os.getenv("SMTP_PASSWORD") or getattr(settings, "EMAIL_HOST_PASSWORD", "")

    if not password:
        candidates = [
            Path("/opt/visioneye/.env"),
            Path("/app/.env"),
            Path("/app/backend/.env"),
            getattr(settings, "BASE_DIR", Path(".")) / ".env",
            getattr(settings, "BASE_DIR", Path(".")).parent / ".env",
        ]
        for p in candidates:
            if p.is_file():
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("SMTP_PASSWORD=") and not line.startswith("#"):
                                val = line.split("=", 1)[1].strip().strip("\"'")
                                if val:
                                    password = val
                                    break
                except Exception:
                    pass
            if password:
                break

    return host, port, user, password


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

        # Compose plain-text and HTML email
        subject = f"VisionEye Verification Code: {otp}"
        text_body = (
            f"Your VisionEye verification code is: {otp}\n\n"
            f"This code will expire in 5 minutes.\n\n"
            f"If you did not request this verification code, please ignore this email.\n"
        )
        html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#070a11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#070a11;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#0e1526;border-radius:16px;border:1px solid #1e293b;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding:28px 24px 20px;text-align:center;border-bottom:1px solid #1e293b;background:linear-gradient(180deg,#111a30,#0e1526);">
              <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:2px;color:#00f0ff;">VISIONEYE</h1>
              <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;letter-spacing:0.5px;">REAL-TIME AI INTELLIGENCE</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <p style="margin:0 0 16px;font-size:14px;color:#cbd5e1;">Your single-use verification passcode is:</p>
              <div style="display:inline-block;background:#070a11;border:2px solid #00f0ff;border-radius:12px;padding:14px 28px;font-size:32px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:800;letter-spacing:8px;color:#00f0ff;">
                {otp}
              </div>
              <p style="margin:20px 0 0;font-size:12px;color:#64748b;">
                Valid for <strong style="color:#94a3b8;">5 minutes</strong>. Never share this code with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px;text-align:center;background:#0a0e1a;border-top:1px solid #1e293b;font-size:11px;color:#475569;">
              VisionEye Platform • Requested for {email}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "VisionEye <pvsaketh1@gmail.com>")
        host, port, user, smtp_password = _get_smtp_credentials()

        email_sent = False
        smtp_error = None

        if smtp_password:
            try:
                from django.core.mail import get_connection, EmailMultiAlternatives
                connection = get_connection(
                    backend="django.core.mail.backends.smtp.EmailBackend",
                    host=host,
                    port=port,
                    username=user,
                    password=smtp_password,
                    use_tls=True,
                    timeout=10,
                )
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=text_body,
                    from_email=from_email,
                    to=[email],
                    connection=connection,
                )
                msg.attach_alternative(html_body, "text/html")
                msg.send(fail_silently=False)
                email_sent = True
                logger.info(f"Successfully sent OTP email via SMTP to {email}")
            except Exception as e:
                smtp_error = str(e)
                logger.error(f"Failed to send email via SMTP to {email}: {e}")
        else:
            smtp_error = "SMTP password is not configured on the server."
            logger.warning(f"[AUTH] Cannot send email to {email}: SMTP password missing.")

        if not email_sent:
            return Response(
                {
                    "error": (
                        f"Failed to send verification code to {email}. "
                        "Server email configuration (SMTP App Password) is required."
                    ),
                    "details": smtp_error,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "status": "sent",
                "email": email,
                "message": f"Verification code sent to {email}. Please check your inbox and spam folder.",
                "expires_in": 300,
            },
            status=status.HTTP_200_OK,
        )


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
