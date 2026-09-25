"""
VisionEye End-to-End Processing Pipeline
Threaded, asynchronous pipeline with real rolling performance metrics (FPS, Latencies)
and Apple Silicon M4 optimizations with YOLO26s ONNX model.
"""
import os
import time
import queue
import logging
import threading
from typing import Dict, Any, List, Optional, Tuple, Callable
import numpy as np
import cv2

from .detector import YOLO26nDetector
from .tracker import ByteTrack
from .analytics import FootTrafficAnalytics
from .privacy import PrivacyMasker
from .perspective import TopViewTransformer
from .video_source import VideoSourceManager
from .utils import draw_hud_boxes, draw_counting_line, draw_homography_overlay, draw_live_counter_hud

logger = logging.getLogger("visioneye.pipeline")


class VisionPipeline:
    """
    Main real-time computer vision pipeline orchestrator.
    Manages video capture, YOLO26s detection, ByteTrack tracking,
    IN/OUT counting, privacy filters, and top-view mapping.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        conf_threshold: float = 0.40,
        broadcast_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        # Enforce yolo26n.onnx for low computation and highest real-time FPS
        default_model = "backend/models/yolo26n.onnx"
        if not os.path.exists(default_model) and os.path.exists("backend/models/yolo26s.onnx"):
            default_model = "backend/models/yolo26s.onnx"

        self.detector = YOLO26nDetector(model_path=model_path or default_model, conf_threshold=conf_threshold)
        self.tracker = ByteTrack(track_thresh=conf_threshold, high_thresh=0.55)
        self.analytics = FootTrafficAnalytics()
        self.privacy = PrivacyMasker(mode="blur", enabled=False)
        self.perspective = TopViewTransformer()
        self.video_source = VideoSourceManager()

        self.broadcast_callback = broadcast_callback
        self.calibration_mode: Optional[str] = None  # None, 'line', 'perspective'

        # Threading & Control
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._latest_frame_bytes: Optional[bytes] = None
        self._latest_telemetry: Dict[str, Any] = {}
        self._lock = threading.Lock()

        # Performance rolling metrics (30-frame window)
        self._fps_history = []
        self._det_latency_history = []
        self._proc_latency_history = []
        self._last_frame_time = time.perf_counter()

    def start(self, source_type: str = "synthetic", source_path: Optional[Any] = None):
        """Starts the background vision processing thread."""
        if self._thread is not None and self._thread.is_alive():
            logger.info("[Pipeline] Pipeline is already active.")
            self.video_source.set_source(source_type, source_path)
            return

        self._stop_event.clear()
        self.video_source.set_source(source_type, source_path)
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="VisionPipelineWorker")
        self._thread.start()
        logger.info("[Pipeline] Background vision pipeline thread started.")

    def stop(self, silent: bool = False):
        """Stops the pipeline thread safely."""
        self._stop_event.set()
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self.video_source.release()
        if not silent:
            try:
                logger.info("[Pipeline] Pipeline stopped.")
            except Exception:
                pass

    def pause(self):
        self.video_source.pause()

    def resume(self):
        self.video_source.resume()

    def reset_analytics(self):
        self.analytics.reset_counts()

    def reset_tracking(self):
        self.tracker.reset()

    def set_calibration_mode(self, mode: Optional[str]):
        """Sets active calibration overlay mode: None, 'line', 'perspective'."""
        self.calibration_mode = mode

    def set_confidence(self, conf: float):
        self.detector.set_confidence_threshold(conf)

    def set_privacy(self, mode: str, enabled: bool):
        self.privacy.set_mode(mode, enabled)

    def set_counting_line(self, p1: Tuple[float, float], p2: Tuple[float, float]):
        self.analytics.set_counting_line(p1, p2)

    def set_perspective(self, points: List[List[float]]):
        self.perspective.set_source_points(points, self.video_source.width, self.video_source.height)

    def auto_calibrate_perspective(self) -> List[List[float]]:
        """1-Click instant ground floor perspective calibration."""
        pts = self.perspective.auto_calibrate(self.video_source.width, self.video_source.height)
        return pts

    def set_perspective_preset(self, preset_name: str) -> List[List[float]]:
        """Applies a named perspective preset (floor, corridor, entrance, full, default)."""
        pts = self.perspective.apply_preset(preset_name, self.video_source.width, self.video_source.height)
        return pts

    def get_latest_frame_jpeg(self) -> Optional[bytes]:
        """Returns the most recent annotated frame encoded as JPEG bytes."""
        with self._lock:
            return self._latest_frame_bytes

    def get_latest_telemetry(self) -> Dict[str, Any]:
        """Returns the most recent analytics telemetry snapshot."""
        with self._lock:
            return self._latest_telemetry

    def _update_rolling_metrics(self, dt: float, det_ms: float, proc_ms: float) -> Tuple[float, float, float]:
        """Calculates stable rolling averages for FPS and latencies."""
        instant_fps = 1.0 / max(0.001, dt)

        self._fps_history.append(instant_fps)
        if len(self._fps_history) > 30:
            self._fps_history.pop(0)

        self._det_latency_history.append(det_ms)
        if len(self._det_latency_history) > 30:
            self._det_latency_history.pop(0)

        self._proc_latency_history.append(proc_ms)
        if len(self._proc_latency_history) > 30:
            self._proc_latency_history.pop(0)

        avg_fps = float(np.mean(self._fps_history))
        avg_det_ms = float(np.mean(self._det_latency_history))
        avg_proc_ms = float(np.mean(self._proc_latency_history))

        return avg_fps, avg_det_ms, avg_proc_ms

    def _run_loop(self):
        """Main asynchronous processing loop."""
        logger.info("[Pipeline] Video loop running.")

        while not self._stop_event.is_set():
            try:
                t_frame_start = time.perf_counter()

                # 1. Capture frame
                ret, raw_frame = self.video_source.read()
                if not ret or raw_frame is None:
                    time.sleep(0.01)
                    continue

                h, w = raw_frame.shape[:2]

                # 2. YOLO26n Inference & Detection (Nano low-computation model)
                detections, det_latency_ms = self.detector.detect(raw_frame)

                # 3. Multi-Person Tracking (ByteTrack)
                active_tracks = self.tracker.update(detections)

                # 4. IN/OUT Counting & Occupancy Analytics
                new_events = self.analytics.process_tracks(active_tracks, w, h)

                # 5. Top-View Homography Mapping
                top_view_entities = self.perspective.transform_tracks(active_tracks, w, h)
                projected_line = self.perspective.transform_line(
                    self.analytics.norm_line_start, self.analytics.norm_line_end, w, h
                )

                # 6. Privacy Masking (Applied before encoding stream)
                rendered_frame = self.privacy.apply(raw_frame, active_tracks)

                # 7. Visual HUD Overlays:
                # - If in perspective calibration mode: draw 4-point homography grid first
                if self.calibration_mode == "perspective":
                    rendered_frame = draw_homography_overlay(rendered_frame, self.perspective.norm_source_points)

                # - Counting line is rendered exclusively on frontend canvas for 60fps interactive editing and zero duplicate lines
                # p1, p2 = self.analytics.get_absolute_line(w, h)

                # - Always draw tracked bounding boxes and trajectory trails with per-person status
                rendered_frame = draw_hud_boxes(rendered_frame, active_tracks, draw_trails=True, analytics=self.analytics)

                # - Always draw permanent high-visibility on-frame scoreboard pills (IN, OUT, INSIDE, ACTIVE)
                rendered_frame = draw_live_counter_hud(
                    rendered_frame,
                    total_in=self.analytics.total_in,
                    total_out=self.analytics.total_out,
                    occupancy=self.analytics.occupancy,
                    active_people=len(active_tracks),
                )

                # 8. Encode to JPEG for MJPEG stream
                _, jpeg_buf = cv2.imencode(".jpg", rendered_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                frame_bytes = jpeg_buf.tobytes()

                # 9. Latency & Performance Measurements
                t_frame_end = time.perf_counter()
                total_proc_ms = (t_frame_end - t_frame_start) * 1000.0
                dt = t_frame_start - self._last_frame_time
                self._last_frame_time = t_frame_start

                avg_fps, avg_det_ms, avg_proc_ms = self._update_rolling_metrics(dt, det_latency_ms, total_proc_ms)

                # 10. Assemble Real-Time Telemetry Payload
                telemetry_payload = {
                    "timestamp": time.time(),
                    "fps": round(avg_fps, 1),
                    "detection_latency_ms": round(avg_det_ms, 1),
                    "processing_latency_ms": round(avg_proc_ms, 1),
                    "resolution": f"{w}x{h}",
                    "model": "YOLO26n ONNX (Nano)",
                    "providers": self.detector.providers_used,
                    "is_mock": self.detector.is_mock,
                    "source": self.video_source.get_info(),
                    "occupancy": self.analytics.occupancy,
                    "total_in": self.analytics.total_in,
                    "total_out": self.analytics.total_out,
                    "active_people": len(active_tracks),
                    "tracks": [
                        {
                            **t.to_dict(),
                            **self.analytics.get_track_status(t.track_id, (t.bottom_center[0], t.bottom_center[1]), w, h),
                        }
                        for t in active_tracks
                    ],
                    "top_view": {
                        "entities": top_view_entities,
                        "projected_line": projected_line,
                        "canvas_size": [self.perspective.canvas_width, self.perspective.canvas_height],
                    },
                    "counting_line": {
                        "start": self.analytics.norm_line_start,
                        "end": self.analytics.norm_line_end,
                    },
                    "perspective_points": self.perspective.norm_source_points,
                    "privacy": {
                        "enabled": self.privacy.enabled,
                        "mode": self.privacy.mode,
                    },
                    "confidence_threshold": self.detector.conf_threshold,
                    "recent_events": list(self.analytics.recent_events)[:6],
                    "flow_history": list(self.analytics.flow_history)[-20:],
                }

                with self._lock:
                    self._latest_frame_bytes = frame_bytes
                    self._latest_telemetry = telemetry_payload

                # 11. Broadcast via WebSocket callback if registered
                if self.broadcast_callback is not None:
                    try:
                        self.broadcast_callback(telemetry_payload)
                    except Exception as e:
                        logger.debug(f"[Pipeline] Broadcast callback error: {e}")

            except Exception as e:
                logger.error(f"[Pipeline] Frame processing exception: {e}", exc_info=True)
                time.sleep(0.02)

        logger.info("[Pipeline] Video loop exited.")
