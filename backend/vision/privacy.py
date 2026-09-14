"""
VisionEye Privacy Masking Module
Provides real-time Gaussian Blur and Pixelation over detected person bounding boxes.
"""
from typing import List, Dict, Any, Optional
import numpy as np
import cv2


class PrivacyMasker:
    """
    Applies privacy filters (blur, pixelate, silhouette) over person bounding boxes.
    """

    def __init__(self, mode: str = "none", enabled: bool = False):
        self.mode = mode.lower()  # 'none', 'blur', 'pixelate', 'mask'
        self.enabled = enabled

    def set_mode(self, mode: str, enabled: Optional[bool] = None):
        """Updates privacy masking configuration."""
        self.mode = mode.lower()
        if enabled is not None:
            self.enabled = enabled

    def apply(self, frame: np.ndarray, detections_or_tracks: List[Any]) -> np.ndarray:
        """
        Applies privacy masking to frame if enabled.
        detections_or_tracks can be list of dicts with 'bbox' or STrack objects.
        """
        if not self.enabled or self.mode == "none":
            return frame

        h, w = frame.shape[:2]
        output_frame = frame.copy()

        for item in detections_or_tracks:
            if hasattr(item, "bbox"):
                bbox = item.bbox
            elif isinstance(item, dict) and "bbox" in item:
                bbox = item["bbox"]
            else:
                continue

            x1 = max(0, int(round(bbox[0])))
            y1 = max(0, int(round(bbox[1])))
            x2 = min(w, int(round(bbox[2])))
            y2 = min(h, int(round(bbox[3])))

            box_w = x2 - x1
            box_h = y2 - y1
            if box_w <= 4 or box_h <= 4:
                continue

            roi = output_frame[y1:y2, x1:x2]

            if self.mode == "blur":
                # Gaussian Blur with kernel proportional to box size
                kw = max(15, (box_w // 4) * 2 + 1)
                kh = max(15, (box_h // 4) * 2 + 1)
                blurred = cv2.GaussianBlur(roi, (kw, kh), sigmaX=30, sigmaY=30)
                output_frame[y1:y2, x1:x2] = blurred

            elif self.mode == "pixelate":
                # Downsample and upsample with nearest neighbor
                pixel_size = max(4, min(16, box_w // 8))
                small_w = max(1, box_w // pixel_size)
                small_h = max(1, box_h // pixel_size)
                temp = cv2.resize(roi, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
                pixelated = cv2.resize(temp, (box_w, box_h), interpolation=cv2.INTER_NEAREST)
                output_frame[y1:y2, x1:x2] = pixelated

            elif self.mode == "mask":
                # Dark shield overlay
                overlay = roi.copy()
                overlay[:] = (20, 25, 35)  # Dark slate
                cv2.addWeighted(overlay, 0.85, roi, 0.15, 0, output_frame[y1:y2, x1:x2])
                cv2.rectangle(output_frame, (x1, y1), (x2, y2), (0, 240, 255), 1)

        return output_frame
