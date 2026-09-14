"""
VisionEye Top-View / Bird's-Eye Perspective Transformer
Homography 4-point Ground Plane Mapping
"""
import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import cv2

logger = logging.getLogger("visioneye.perspective")


class TopViewTransformer:
    """
    Computes 4-point homography and maps person bottom-center points
    from the camera perspective to a 2D top-view / bird's-eye canvas.
    """

    PRESETS = {
        "default": [[0.20, 0.45], [0.80, 0.45], [0.95, 0.95], [0.05, 0.95]],
        "floor": [[0.20, 0.45], [0.80, 0.45], [0.95, 0.95], [0.05, 0.95]],
        "corridor": [[0.32, 0.35], [0.68, 0.35], [0.88, 0.95], [0.12, 0.95]],
        "entrance": [[0.15, 0.40], [0.85, 0.40], [0.98, 0.92], [0.02, 0.92]],
        "full": [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]],
    }

    def __init__(
        self,
        source_points: Optional[List[List[float]]] = None,
        canvas_width: int = 400,
        canvas_height: int = 400,
    ):
        self.canvas_width = canvas_width
        self.canvas_height = canvas_height

        # Default normalized source points (trapezoid on ground plane)
        # [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
        self.norm_source_points = source_points or [
            [0.20, 0.45],  # TL
            [0.80, 0.45],  # TR
            [0.95, 0.95],  # BR
            [0.05, 0.95],  # BL
        ]

        self.homography_matrix = None
        self._compute_matrix(640, 480)

    def set_source_points(self, points: List[List[float]], frame_width: int = 640, frame_height: int = 480):
        """
        Updates 4 source calibration points (normalized [0.0, 1.0]).
        """
        if len(points) == 4:
            self.norm_source_points = [
                [max(0.0, min(1.0, float(p[0]))), max(0.0, min(1.0, float(p[1])))]
                for p in points
            ]
            self._compute_matrix(frame_width, frame_height)
            logger.info(f"[TopViewTransformer] Homography matrix recalibrated with points: {self.norm_source_points}")

    def apply_preset(self, preset_name: str, frame_width: int = 640, frame_height: int = 480) -> List[List[float]]:
        """Applies a named calibration preset."""
        preset = self.PRESETS.get(preset_name.lower(), self.PRESETS["default"])
        self.set_source_points(preset, frame_width, frame_height)
        return self.norm_source_points

    def auto_calibrate(self, frame_width: int = 640, frame_height: int = 480) -> List[List[float]]:
        """1-Click Instant Ground Floor Calibration."""
        return self.apply_preset("floor", frame_width, frame_height)

    def _compute_matrix(self, frame_width: int, frame_height: int):
        """Calculates 3x3 homography matrix from 4 source points to top-view rectangle."""
        try:
            src_pts = np.float32([
                [p[0] * frame_width, p[1] * frame_height] for p in self.norm_source_points
            ])
            dst_pts = np.float32([
                [0, 0],
                [self.canvas_width, 0],
                [self.canvas_width, self.canvas_height],
                [0, self.canvas_height],
            ])
            self.homography_matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
        except Exception as e:
            logger.error(f"[TopViewTransformer] Failed to compute perspective transform: {e}")
            self.homography_matrix = None

    def transform_point(self, pt: Tuple[float, float], frame_width: int, frame_height: int) -> Optional[Tuple[float, float]]:
        """
        Transforms a single ground point (bx, by) to top-view (top_x, top_y).
        """
        if self.homography_matrix is None:
            self._compute_matrix(frame_width, frame_height)

        if self.homography_matrix is None:
            # Fallback linear mapping
            norm_x = max(0.0, min(1.0, pt[0] / max(1.0, frame_width)))
            norm_y = max(0.0, min(1.0, pt[1] / max(1.0, frame_height)))
            return norm_x * self.canvas_width, norm_y * self.canvas_height

        src_arr = np.array([[[float(pt[0]), float(pt[1])]]], dtype=np.float32)
        try:
            dst_arr = cv2.perspectiveTransform(src_arr, self.homography_matrix)
            top_x = float(dst_arr[0][0][0])
            top_y = float(dst_arr[0][0][1])

            # Clamp within top-view bounds with slight margin
            top_x = max(-20.0, min(self.canvas_width + 20.0, top_x))
            top_y = max(-20.0, min(self.canvas_height + 20.0, top_y))
            return top_x, top_y
        except Exception as e:
            logger.debug(f"[TopViewTransformer] Transform error for pt {pt}: {e}")
            return None

    def transform_tracks(
        self,
        tracks: List[Any],
        frame_width: int,
        frame_height: int,
    ) -> List[Dict[str, Any]]:
        """
        Projects all active tracks onto the 2D top-view ground canvas.
        Returns list of top-view points with track IDs and trails.
        """
        top_view_entities = []

        for track in tracks:
            # Use bottom-center point (closest approximation to ground contact position)
            bx, by = track.bottom_center
            res = self.transform_point((bx, by), frame_width, frame_height)
            if res is None:
                continue

            top_x, top_y = res

            # Transform recent trail
            trail_pts = []
            for item in list(track.history)[-10:]:
                h_bx, h_by = item[2], item[3]
                t_pt = self.transform_point((h_bx, h_by), frame_width, frame_height)
                if t_pt:
                    trail_pts.append({"x": round(t_pt[0], 1), "y": round(t_pt[1], 1)})

            top_view_entities.append({
                "track_id": track.track_id,
                "x": round(top_x, 1),
                "y": round(top_y, 1),
                "norm_x": round(top_x / self.canvas_width, 3),
                "norm_y": round(top_y / self.canvas_height, 3),
                "trail": trail_pts,
                "confidence": getattr(track, "confidence", 1.0),
            })

        return top_view_entities

    def transform_line(self, norm_start: List[float], norm_end: List[float], frame_width: int, frame_height: int) -> Optional[Dict[str, Any]]:
        """Projects virtual counting line endpoints onto top-view canvas."""
        p1 = (norm_start[0] * frame_width, norm_start[1] * frame_height)
        p2 = (norm_end[0] * frame_width, norm_end[1] * frame_height)
        t1 = self.transform_point(p1, frame_width, frame_height)
        t2 = self.transform_point(p2, frame_width, frame_height)
        if t1 and t2:
            return {
                "start": [round(t1[0], 1), round(t1[1], 1)],
                "end": [round(t2[0], 1), round(t2[1], 1)],
                "norm_start": [round(t1[0] / self.canvas_width, 3), round(t1[1] / self.canvas_height, 3)],
                "norm_end": [round(t2[0] / self.canvas_width, 3), round(t2[1] / self.canvas_height, 3)],
            }
        return None

    def get_config(self) -> Dict[str, Any]:
        """Returns perspective configuration for frontend."""
        return {
            "source_points": self.norm_source_points,
            "canvas_size": [self.canvas_width, self.canvas_height],
        }

