"""
VisionEye REST API Views and MJPEG Streaming Endpoints
"""
import os
import re
import time
import platform
import logging
import base64
import cv2
import numpy as np
import socket
import urllib.parse
from django.http import StreamingHttpResponse, JsonResponse
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .apps import get_pipeline
from vision.video_source import VideoSourceManager

logger = logging.getLogger("visioneye.views")


class HealthCheckView(APIView):
    """
    Health check and system diagnostics endpoint.
    GET /api/health
    """

    def get(self, request):
        pipeline = get_pipeline()
        is_arm64 = platform.machine() in ["arm64", "aarch64"]
        is_macos = platform.system() == "Darwin"

        return Response({
            "status": "healthy",
            "service": "VisionEye Foot-Traffic Analytics",
            "platform": {
                "system": platform.system(),
                "machine": platform.machine(),
                "processor": platform.processor(),
                "is_apple_silicon": is_macos and is_arm64,
                "chip_target": "Apple Silicon M4 / M-Series",
            },
            "model": {
                "name": "YOLO26n ONNX",
                "path": pipeline.detector.model_path,
                "exists": os.path.exists(pipeline.detector.model_path),
                "is_simulation_mode": pipeline.detector.is_mock,
                "active_providers": pipeline.detector.providers_used,
            },
            "pipeline": {
                "is_running": pipeline.video_source.is_running,
                "is_paused": pipeline.video_source.is_paused,
                "source_type": pipeline.video_source.source_type,
                "resolution": f"{pipeline.video_source.width}x{pipeline.video_source.height}",
            },
            "timestamp": time.time(),
        })


class AvailableCamerasView(APIView):
    """
    Scans and lists available camera devices dynamically.
    GET /api/cameras
    """

    def get(self, request):
        cameras = VideoSourceManager.list_available_cameras()
        return Response({"cameras": cameras, "count": len(cameras)})


class VideoSourceControlView(APIView):
    """
    Controls video feed: Start, Stop, Pause, Resume.
    POST /api/video/start
    POST /api/video/stop
    POST /api/video/pause
    POST /api/video/resume
    """

    def post(self, request, action):
        pipeline = get_pipeline()

        try:
            if action == "start":
                source_type = request.data.get("source_type", "synthetic")
                source_path = request.data.get("source_path", None)
                camera_index = request.data.get("camera_index", None)
                username = request.data.get("username", None)
                password = request.data.get("password", None)

                if source_type == "webcam":
                    source_path = int(camera_index if camera_index is not None else 0)
                elif source_type == "rtsp" and source_path:
                    # Embed credentials if provided and not already in URL
                    if username and "@" not in source_path:
                        parsed = urllib.parse.urlparse(source_path)
                        auth = f"{urllib.parse.quote(username)}:{urllib.parse.quote(password or '')}@"
                        netloc = f"{auth}{parsed.hostname}"
                        if parsed.port:
                            netloc += f":{parsed.port}"
                        source_path = urllib.parse.urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))

                pipeline.start(source_type=source_type, source_path=source_path)
                return Response({"status": "started", "source": pipeline.video_source.get_info()})

            elif action == "stop":
                pipeline.stop()
                return Response({"status": "stopped"})

            elif action == "pause":
                pipeline.pause()
                return Response({"status": "paused"})

            elif action == "resume":
                pipeline.resume()
                return Response({"status": "resumed"})

            return Response({"error": "Unknown video control action"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"[VideoSourceControlView] Error handling action '{action}': {e}", exc_info=True)
            return Response({"status": "error", "message": str(e), "source": pipeline.video_source.get_info()}, status=status.HTTP_200_OK)


class TestRTSPConnectionView(APIView):
    """
    Validates RTSP camera connectivity on local network/LAN without exposing raw errors.
    POST /api/video/test-rtsp
    """

    def post(self, request):
        raw_url = request.data.get("rtsp_url", "").strip()
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "").strip()
        timeout_sec = float(request.data.get("timeout", 3.0))

        if not raw_url:
            return Response({
                "status": "failed",
                "state": "invalid_url",
                "message": "Please enter an RTSP stream URL (e.g., rtsp://192.168.1.100:554/stream).",
                "technical_details": None,
            }, status=status.HTTP_400_BAD_REQUEST)

        if not raw_url.lower().startswith("rtsp://"):
            return Response({
                "status": "failed",
                "state": "invalid_url",
                "message": "Invalid protocol. Camera stream URL must begin with 'rtsp://'.",
                "technical_details": {"protocol": raw_url.split(":")[0]},
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            parsed = urllib.parse.urlparse(raw_url)
            host = parsed.hostname
            port = parsed.port or 554

            if not host:
                return Response({
                    "status": "failed",
                    "state": "invalid_url",
                    "message": "Could not identify camera IP address or hostname from the URL.",
                    "technical_details": {"raw_url": raw_url},
                }, status=status.HTTP_400_BAD_REQUEST)

            # Build full authenticated URL for stream test
            if username and "@" not in raw_url:
                auth = f"{urllib.parse.quote(username)}:{urllib.parse.quote(password)}@"
                netloc = f"{auth}{host}:{port}"
                full_test_url = urllib.parse.urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
            else:
                full_test_url = raw_url

            # 1. Non-blocking Socket LAN Connectivity Ping
            t_start = time.perf_counter()
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(min(timeout_sec, 2.5))
            try:
                s.connect((host, port))
                s.close()
                latency_ms = round((time.perf_counter() - t_start) * 1000.0, 1)
            except socket.timeout:
                return Response({
                    "status": "failed",
                    "state": "timeout",
                    "message": "Camera connection timed out. Make sure your camera is powered on and connected to the same Wi-Fi/network.",
                    "technical_details": {"host": host, "port": port, "timeout_seconds": timeout_sec},
                })
            except (socket.error, ConnectionRefusedError, OSError) as sock_err:
                return Response({
                    "status": "failed",
                    "state": "unreachable",
                    "message": "Unable to reach camera on the local network. Verify the IP address and make sure both devices share the same LAN.",
                    "technical_details": {"host": host, "port": port, "error": str(sock_err)},
                })

            # 2. Test Stream Decoder via OpenCV FFmpeg with TCP Transport
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp;timeout;3000000"
            test_cap = cv2.VideoCapture(full_test_url, cv2.CAP_FFMPEG)
            is_opened = test_cap.isOpened()

            res_w, res_h, stream_fps = 0, 0, 0.0
            if is_opened:
                ret, frame = test_cap.read()
                if ret and frame is not None:
                    res_h, res_w = frame.shape[:2]
                    stream_fps = round(test_cap.get(cv2.CAP_PROP_FPS) or 25.0, 1)
                test_cap.release()

            if not is_opened:
                return Response({
                    "status": "failed",
                    "state": "auth_failed" if (username or password) else "failed",
                    "message": "Camera reached, but video stream could not be opened. Check your username, password, or stream path.",
                    "technical_details": {"host": host, "port": port, "latency_ms": latency_ms, "transport": "TCP"},
                })

            return Response({
                "status": "connected",
                "state": "connected",
                "message": "Camera detected on local network. Live stream ready for analytics.",
                "technical_details": {
                    "host": host,
                    "port": port,
                    "latency_ms": latency_ms,
                    "resolution": f"{res_w}x{res_h}" if res_w > 0 else "Auto",
                    "fps": stream_fps if stream_fps > 0 else 25.0,
                    "transport": "TCP",
                },
            })

        except Exception as ex:
            logger.error(f"[TestRTSPConnectionView] Unexpected error: {ex}", exc_info=True)
            return Response({
                "status": "failed",
                "state": "failed",
                "message": "Unable to connect to the camera. Make sure your camera and VisionEye device are connected to the same Wi-Fi/network.",
                "technical_details": {"error": str(ex)},
            })


class VideoUploadView(APIView):
    """
    Accepts video file uploads (MP4, AVI, MOV, MKV, WebM) and plays it in the pipeline.
    POST /api/video/upload
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        try:
            video_file = request.FILES.get("video") or request.FILES.get("file")
            if not video_file:
                return Response({"error": "No video file provided in request"}, status=status.HTTP_400_BAD_REQUEST)

            # Sanitize filename for cross-platform compatibility (macOS/Linux/Windows)
            raw_name = os.path.basename(video_file.name)
            clean_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', raw_name)
            if not clean_name:
                clean_name = f"upload_{int(time.time())}.mp4"

            # Save to media folder
            upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, clean_name)

            with open(file_path, "wb+") as destination:
                for chunk in video_file.chunks():
                    destination.write(chunk)

            logger.info(f"[VideoUpload] Video successfully saved to: {file_path} ({video_file.size} bytes)")

            # Automatically switch pipeline to play the uploaded file
            pipeline = get_pipeline()
            started = pipeline.start(source_type="file", source_path=file_path)

            return Response({
                "status": "uploaded_and_started" if started else "uploaded",
                "file_name": clean_name,
                "file_path": file_path,
                "source_info": pipeline.video_source.get_info(),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"[VideoUploadView] Upload failed: {e}", exc_info=True)
            return Response({"error": f"Failed to process video: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


import base64


class ClientFramePushView(APIView):
    """
    Accepts real-time camera frames streamed directly from client browsers and mobile phones.
    POST /api/video/client_frame
    """
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):
        pipeline = get_pipeline(auto_start=True)
        img_data = request.data.get("frame")

        frame = None
        # Support multipart file upload
        if request.FILES.get("frame"):
            file_bytes = request.FILES.get("frame").read()
            nparr = np.frombuffer(file_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif img_data:
            if "," in str(img_data):
                img_data = str(img_data).split(",", 1)[1]
            file_bytes = base64.b64decode(img_data)
            nparr = np.frombuffer(file_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is not None and frame.size > 0:
            pipeline.video_source.push_client_frame(frame)
            return Response({"status": "ok", "telemetry": pipeline.get_latest_telemetry()})

        return Response({"error": "No valid frame decoded"}, status=status.HTTP_400_BAD_REQUEST)



class ConfigView(APIView):
    """
    Manages runtime pipeline configuration.
    GET /api/config
    POST /api/config
    """

    def get(self, request):
        pipeline = get_pipeline()
        return Response({
            "confidence_threshold": pipeline.detector.conf_threshold,
            "privacy": {
                "enabled": pipeline.privacy.enabled,
                "mode": pipeline.privacy.mode,
            },
            "counting_line": {
                "start": pipeline.analytics.norm_line_start,
                "end": pipeline.analytics.norm_line_end,
            },
            "perspective_points": pipeline.perspective.norm_source_points,
            "calibration_mode": pipeline.calibration_mode,
        })

    def post(self, request):
        pipeline = get_pipeline()
        data = request.data

        if "confidence_threshold" in data:
            pipeline.set_confidence(float(data["confidence_threshold"]))

        if "privacy" in data:
            priv = data["privacy"]
            mode = priv.get("mode", pipeline.privacy.mode)
            enabled = priv.get("enabled", pipeline.privacy.enabled)
            pipeline.set_privacy(mode, enabled)

        if "calibration_mode" in data:
            pipeline.set_calibration_mode(data["calibration_mode"])

        return Response({"status": "updated", "config": self.get(request).data})


class CountingLineView(APIView):
    """
    Gets or sets the virtual counting line coordinates.
    GET /api/counting-line
    POST /api/counting-line
    """

    def get(self, request):
        pipeline = get_pipeline()
        return Response({
            "start": pipeline.analytics.norm_line_start,
            "end": pipeline.analytics.norm_line_end,
        })

    def post(self, request):
        pipeline = get_pipeline()
        start_pt = request.data.get("start")
        end_pt = request.data.get("end")

        if not start_pt or not end_pt:
            return Response({"error": "Both start and end points required"}, status=status.HTTP_400_BAD_REQUEST)

        pipeline.set_counting_line(start_pt, end_pt)
        return Response({"status": "updated", "counting_line": self.get(request).data})


class PerspectiveView(APIView):
    """
    Gets or sets 4-point homography calibration source points.
    GET /api/perspective
    POST /api/perspective
    """

    def get(self, request):
        pipeline = get_pipeline()
        return Response(pipeline.perspective.get_config())

    def post(self, request):
        pipeline = get_pipeline()
        
        # Support 1-click auto calibration or presets
        preset = request.data.get("preset")
        if preset:
            pipeline.set_perspective_preset(preset)
            return Response({"status": "updated", "preset": preset, "config": pipeline.perspective.get_config()})
            
        if request.data.get("auto_calibrate"):
            pipeline.auto_calibrate_perspective()
            return Response({"status": "auto_calibrated", "config": pipeline.perspective.get_config()})

        points = request.data.get("points")
        if not points or len(points) != 4:
            return Response({"error": "Exactly 4 points required [[x,y], ...]"}, status=status.HTTP_400_BAD_REQUEST)

        pipeline.set_perspective(points)
        return Response({"status": "updated", "config": pipeline.perspective.get_config()})


class AnalyticsView(APIView):
    """
    Returns current analytics snapshot or resets counters.
    GET /api/analytics
    POST /api/analytics/reset
    """

    def get(self, request):
        pipeline = get_pipeline()
        return Response(pipeline.get_latest_telemetry())

    def post(self, request):
        # Reset counters
        pipeline = get_pipeline()
        pipeline.reset_analytics()
        return Response({"status": "analytics_reset", "occupancy": 0, "total_in": 0, "total_out": 0})


class ResetTrackingView(APIView):
    """
    Resets tracking IDs and trajectory history.
    POST /api/tracking/reset
    """

    def post(self, request):
        pipeline = get_pipeline()
        pipeline.reset_tracking()
        return Response({"status": "tracking_reset"})


import asyncio
from django.http import StreamingHttpResponse, HttpResponse, JsonResponse, FileResponse



async def video_feed_stream(request):
    """
    High-performance, ultra-low-latency async MJPEG video streaming view for Daphne ASGI.
    GET /api/video/feed
    """
    pipeline = get_pipeline(auto_start=True)
    if not pipeline.video_source.is_running:
        pipeline.start(source_type=pipeline.video_source.source_type or "synthetic")

    async def frame_generator():
        last_frame_id = -1
        while True:
            frame_id, frame_bytes = pipeline.get_latest_frame_with_id()
            if frame_bytes is not None and frame_id != last_frame_id:
                last_frame_id = frame_id
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame_bytes)).encode("utf-8") + b"\r\n\r\n"
                    + frame_bytes + b"\r\n"
                )
                await asyncio.sleep(0.01)
            else:
                await asyncio.sleep(0.008)

    response = StreamingHttpResponse(
        frame_generator(),
        content_type="multipart/x-mixed-replace; boundary=frame"
    )
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


def video_single_frame(request):
    """
    Returns the latest single annotated JPEG frame.
    GET /api/video/frame
    """
    pipeline = get_pipeline()
    frame_bytes = pipeline.get_latest_frame_jpeg()
    if frame_bytes is None:
        return HttpResponse(b"", status=204, content_type="image/jpeg")
    response = HttpResponse(frame_bytes, content_type="image/jpeg")
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


import mimetypes
from pathlib import Path

# Register custom MIME types
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")


def serve_react_app(request, path=""):
    """
    Universal SPA router: Serves React frontend dist files (index.html, assets, manifest, icons).
    Works in both local development and Docker / Azure VM environments.
    """
    possible_dist_dirs = [
        settings.BASE_DIR.parent / "frontend" / "dist",
        settings.BASE_DIR / "frontend" / "dist",
        Path("/app/frontend/dist"),
        Path("/var/www/frontend/dist"),
    ]

    dist_dir = None
    for d in possible_dist_dirs:
        if d.exists() and (d / "index.html").exists():
            dist_dir = d
            break

    if not dist_dir:
        return HttpResponse(
            """<!DOCTYPE html>
            <html>
            <head><title>VisionEye — Live Dashboard</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="background:#060913;color:#00F0FF;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;padding:2rem;border:1px solid rgba(0,240,255,0.3);border-radius:12px;background:rgba(13,19,33,0.8);">
                <h1 style="margin:0 0 1rem 0;">⚡ VISIONEYE LIVE CLIENT</h1>
                <p style="color:#94a3b8;">Frontend assets are compiling. Please build the frontend SPA:</p>
                <code style="background:#0b0f19;padding:0.5rem 1rem;border-radius:6px;color:#10b981;display:inline-block;">cd frontend && npm run build</code>
                <div style="margin-top:1.5rem;"><a href="/api/health" style="color:#00F0FF;">Check Backend Health API &rarr;</a></div>
            </div>
            </body>
            </html>""",
            content_type="text/html",
        )

    # Clean requested path
    clean_path = path.lstrip("/") if path else ""

    # If a specific static file is requested (assets, favicon, manifest, etc.)
    if clean_path:
        target_file = dist_dir / clean_path
        if target_file.exists() and target_file.is_file():
            content_type, _ = mimetypes.guess_type(str(target_file))
            content_type = content_type or "application/octet-stream"
            response = FileResponse(open(target_file, "rb"), content_type=content_type)
            if clean_path.startswith("assets/"):
                response["Cache-Control"] = "public, max-age=31536000, immutable"
            else:
                response["Cache-Control"] = "public, max-age=3600"
            return response

    # Fallback to index.html for React SPA client-side routing
    index_file = dist_dir / "index.html"
    response = FileResponse(open(index_file, "rb"), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response

