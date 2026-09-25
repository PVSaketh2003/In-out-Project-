"""
VisionEye Video Source Manager
Supports Dynamic macOS Webcam Discovery, Video Files, RTSP Streams, and Synthetic Demo Stream.
"""
import os
import time
import platform
import logging
import threading
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import cv2

logger = logging.getLogger("visioneye.video_source")


class VideoSourceManager:
    """
    Unified manager for multiple video input streams:
    - Dynamic Webcam (macOS AVFoundation index scan)
    - Local Video Files (with auto-looping)
    - RTSP Streams (with auto-reconnect)
    - Synthetic Demo Video Source (built-in out-of-the-box generator)
    """

    def __init__(self):
        self.source_type = "synthetic"  # 'webcam', 'file', 'rtsp', 'synthetic'
        self.source_path = None
        self.camera_index = 0
        self.cap = None
        self.fps = 30.0
        self.width = 640
        self.height = 480
        self.is_running = False
        self.is_paused = False
        self._lock = threading.Lock()
        self._sim_time = 0.0
        self._client_frame = None
        self._last_client_frame_time = 0.0

    @staticmethod
    def list_available_cameras() -> List[Dict[str, Any]]:
        """
        Dynamically probes available local camera devices on macOS / Linux / Windows.
        Returns list of {index, name, resolution, is_available}.
        """
        cameras = []
        is_macos = platform.system() == "Darwin"

        # Check indices 0 through 4
        for idx in range(4):
            backend = cv2.CAP_AVFOUNDATION if is_macos else cv2.CAP_ANY
            cap = cv2.VideoCapture(idx, backend)
            if cap is not None and cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)
                cap_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

                camera_name = f"Built-in FaceTime HD / Camera #{idx}" if idx == 0 else f"External Camera #{idx}"
                cameras.append({
                    "index": idx,
                    "name": camera_name,
                    "resolution": f"{w}x{h}",
                    "fps": round(float(cap_fps), 1),
                    "is_available": True,
                })
                cap.release()
            else:
                if cap is not None:
                    cap.release()

        # If no cameras found (e.g. headless or permissions restricted), provide fallback entry
        if not cameras:
            cameras.append({
                "index": 0,
                "name": "Default Video Capture Device (0)",
                "resolution": "640x480",
                "fps": 30.0,
                "is_available": False,
                "note": "Camera permission required or device busy",
            })

        return cameras

    def set_source(self, source_type: str, source_path: Optional[Any] = None) -> bool:
        """
        Switches video source: 'webcam' (int index), 'file' (str path), 'rtsp' (str url), 'synthetic'.
        """
        with self._lock:
            self.release()
            self.source_type = source_type.lower()
            self.source_path = source_path
            self.is_paused = False

            logger.info(f"[VideoSourceManager] Opening source: type='{self.source_type}', path='{self.source_path}'")

            is_macos = platform.system() == "Darwin"

            try:
                if self.source_type == "webcam":
                    cam_idx = int(source_path if source_path is not None else 0)
                    self.camera_index = cam_idx
                    backend = cv2.CAP_AVFOUNDATION if is_macos else cv2.CAP_ANY
                    self.cap = cv2.VideoCapture(cam_idx, backend)
                    if not self.cap.isOpened():
                        # Try generic backend
                        self.cap = cv2.VideoCapture(cam_idx)

                    if self.cap.isOpened():
                        # Request 720p or standard resolution
                        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
                        self.is_running = True
                        logger.info(f"[VideoSourceManager] Webcam #{cam_idx} opened: {self.width}x{self.height} @ {self.fps} FPS")
                        return True
                    else:
                        logger.warning(f"[VideoSourceManager] Failed to open Webcam #{cam_idx}. Falling back to synthetic stream.")
                        self.source_type = "synthetic"
                        self.is_running = True
                        return True

                elif self.source_type == "file":
                    if not os.path.exists(str(source_path)):
                        logger.error(f"[VideoSourceManager] File not found: {source_path}")
                        self.source_type = "synthetic"
                        self.is_running = True
                        return True

                    self.cap = cv2.VideoCapture(str(source_path))
                    if self.cap.isOpened():
                        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
                        self.is_running = True
                        logger.info(f"[VideoSourceManager] Video file opened: {source_path} ({self.width}x{self.height} @ {self.fps} FPS)")
                        return True
                    else:
                        logger.error(f"[VideoSourceManager] Could not open video file: {source_path}")
                        self.source_type = "synthetic"
                        self.is_running = True
                        return True

                elif self.source_type == "rtsp":
                    # Open RTSP stream with FFMPEG using TCP transport for packet integrity
                    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp;timeout;5000000"
                    self.cap = cv2.VideoCapture(str(source_path), cv2.CAP_FFMPEG)
                    safe_url = re.sub(r':([^@]+)@', ':****@', str(source_path)) if source_path else "rtsp"
                    if self.cap.isOpened():
                        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
                        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
                        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
                        self.is_running = True
                        logger.info(f"[VideoSourceManager] RTSP stream connected: {safe_url} ({self.width}x{self.height} @ {self.fps} FPS)")
                        return True
                    else:
                        logger.error(f"[VideoSourceManager] Failed to connect to RTSP stream: {safe_url}")
                        self.source_type = "synthetic"
                        self.is_running = True
                        return True

                elif self.source_type in ("client", "device_camera", "browser_camera"):
                    self.source_type = "client"
                    self.width = 640
                    self.height = 480
                    self.fps = 30.0
                    self.is_running = True
                    return True

                else:  # synthetic
                    self.width = 640
                    self.height = 480
                    self.fps = 30.0
                    self.is_running = True
                    return True

            except Exception as e:
                logger.error(f"[VideoSourceManager] Exception opening video source: {e}", exc_info=True)
                self.source_type = "synthetic"
                self.is_running = True
                return True

    def push_client_frame(self, frame: np.ndarray):
        """Pushes a live frame captured from a client browser or smartphone camera."""
        with self._lock:
            self.source_type = "client"
            self._client_frame = frame
            self.width = frame.shape[1]
            self.height = frame.shape[0]
            self._last_client_frame_time = time.time()
            self.is_running = True

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """
        Reads the next frame. Auto-loops video files and handles stream reconnections.
        """
        if not self.is_running:
            return False, None

        if self.is_paused:
            time.sleep(0.033)
            return False, None

        with self._lock:
            if self.source_type == "client":
                if self._client_frame is not None and (time.time() - self._last_client_frame_time) < 4.0:
                    return True, self._client_frame.copy()
                # Fallback to demo if client stopped sending frames
                frame = self._generate_synthetic_frame()
                return True, frame

            if self.source_type == "synthetic":
                frame = self._generate_synthetic_frame()
                return True, frame

            if self.cap is None or not self.cap.isOpened():
                frame = self._generate_synthetic_frame()
                return True, frame

            ret, frame = self.cap.read()
            if not ret or frame is None or frame.size == 0:
                if self.source_type == "file" and self.source_path and os.path.exists(str(self.source_path)):
                    # 1. First attempt: Seek back to frame 0
                    try:
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ret, frame = self.cap.read()
                    except Exception as ex:
                        logger.debug(f"[VideoSourceManager] Seek to frame 0 error: {ex}")
                        ret, frame = False, None

                    # 2. Second attempt: If seek returned empty/failed, cleanly reopen capture
                    if not ret or frame is None or frame.size == 0:
                        try:
                            if self.cap is not None:
                                self.cap.release()
                            self.cap = cv2.VideoCapture(str(self.source_path))
                            ret, frame = self.cap.read()
                            if ret and frame is not None:
                                logger.info(f"[VideoSourceManager] Video looped seamlessly: {self.source_path}")
                        except Exception as ex:
                            logger.error(f"[VideoSourceManager] Error reopening video on loop: {ex}")

                    if not ret or frame is None or frame.size == 0:
                        logger.warning("[VideoSourceManager] Video stream ended and could not loop. Using synthetic stream.")
                        frame = self._generate_synthetic_frame()
                        return True, frame
                else:
                    frame = self._generate_synthetic_frame()
                    return True, frame

            # Cap high-res / 4K frames to max 1280px width for real-time smoothness
            if frame.shape[1] > 1280:
                scale = 1280.0 / float(frame.shape[1])
                new_w = 1280
                new_h = int(frame.shape[0] * scale)
                frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)

            self.width = frame.shape[1]
            self.height = frame.shape[0]

            # Real-time pacing for file playback
            if self.source_type == "file":
                target_fps = max(15.0, min(60.0, float(self.fps if self.fps > 0 else 30.0)))
                time.sleep(1.0 / target_fps)

            return True, frame

    def _generate_synthetic_frame(self) -> np.ndarray:
        """
        Generates a realistic modern facility lobby with floor tiles, entrance doorway,
        and pedestrians crossing back and forth for instant live analytics demonstration.
        """
        self._sim_time += 0.033
        t = self._sim_time
        w, h = 640, 480

        # Background floor & facility interior
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frame[:] = (22, 27, 34)  # Deep futuristic slate

        # Draw tile perspective lines
        tile_color = (35, 43, 54)
        for x in range(0, w, 40):
            cv2.line(frame, (x, int(h * 0.4)), (int((x - w / 2) * 1.8 + w / 2), h), tile_color, 1)
        for y in range(int(h * 0.4), h, 30):
            cv2.line(frame, (0, y), (w, y), tile_color, 1)

        # Entrance doorway at top
        cv2.rectangle(frame, (int(w * 0.25), 0), (int(w * 0.75), int(h * 0.4)), (18, 22, 28), -1)
        cv2.rectangle(frame, (int(w * 0.25), 0), (int(w * 0.75), int(h * 0.4)), (0, 180, 216), 1)

        # Facility label
        cv2.putText(frame, "VISIONEYE LIVE TEST FACILITY - NORTH GATE", (20, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 149, 237), 1, cv2.LINE_AA)

        # Render moving person avatars (synthetic silhouettes that YOLO or detector identifies)
        # Person 1: Walking IN (downward towards camera)
        p1_x = int(w * 0.35 + np.sin(t * 0.8) * 40)
        p1_y = int(h * 0.30 + ((t * 60) % (h * 0.55)))
        self._draw_person_silhouette(frame, p1_x, p1_y, scale=1.0 + (p1_y / h) * 0.4, color=(240, 180, 80))

        # Person 2: Walking OUT (upward away from camera)
        p2_x = int(w * 0.65 - np.cos(t * 0.7) * 35)
        p2_y = int(h * 0.85 - ((t * 50) % (h * 0.55)))
        self._draw_person_silhouette(frame, p2_x, p2_y, scale=1.0 + (p2_y / h) * 0.4, color=(80, 220, 160))

        # Person 3: Cross-traffic pedestrian
        p3_x = int((t * 70) % (w * 0.9) + 30)
        p3_y = int(h * 0.60 + np.sin(t * 1.5) * 15)
        self._draw_person_silhouette(frame, p3_x, p3_y, scale=1.2, color=(200, 120, 240))

        time.sleep(0.025)  # Throttle to ~30 FPS
        return frame

    def _draw_person_silhouette(self, img: np.ndarray, x: int, y: int, scale: float, color: Tuple[int, int, int]):
        """Draws human silhouette figure on synthetic frame."""
        head_radius = int(12 * scale)
        body_w = int(24 * scale)
        body_h = int(60 * scale)

        head_center = (x, y - body_h - head_radius)
        # Head
        cv2.circle(img, head_center, head_radius, color, -1, cv2.LINE_AA)
        # Torso
        cv2.ellipse(img, (x, y - body_h // 2), (body_w // 2, body_h // 2), 0, 0, 360, color, -1, cv2.LINE_AA)
        # Legs
        leg_len = int(40 * scale)
        cv2.line(img, (x - 6, y - 5), (x - 8, y + leg_len), color, max(2, int(4 * scale)), cv2.LINE_AA)
        cv2.line(img, (x + 6, y - 5), (x + 8, y + leg_len), color, max(2, int(4 * scale)), cv2.LINE_AA)

    def pause(self):
        self.is_paused = True

    def resume(self):
        self.is_paused = False

    def release(self):
        """Safely releases camera and hardware resources."""
        self.is_running = False
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None

    def get_info(self) -> Dict[str, Any]:
        return {
            "source_type": self.source_type,
            "source_path": self.source_path,
            "camera_index": self.camera_index,
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "resolution": f"{self.width}x{self.height}",
            "fps": round(self.fps, 1),
        }
