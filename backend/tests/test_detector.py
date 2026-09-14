"""
Unit tests for YOLO26n ONNX detector on Apple Silicon.
"""
import pytest
import numpy as np
from vision.detector import YOLO26nDetector


def test_detector_initialization():
    detector = YOLO26nDetector(model_path="backend/models/yolo26n.onnx")
    assert detector is not None
    assert detector.conf_threshold == 0.40
    assert len(detector.providers_used) > 0


def test_detector_letterbox():
    detector = YOLO26nDetector(model_path="backend/models/yolo26n.onnx")
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    padded, ratio, pad = detector.letterbox(img, (640, 640))
    assert padded.shape == (640, 640, 3)
    assert ratio == 1.0


def test_detector_inference():
    detector = YOLO26nDetector(model_path="backend/models/yolo26n.onnx")
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    detections, latency_ms = detector.detect(frame)
    assert isinstance(detections, list)
    assert latency_ms > 0.0
    for d in detections:
        assert "bbox" in d
        assert "confidence" in d
        assert "center" in d
        assert "bottom_center" in d
        assert d["confidence"] >= detector.conf_threshold
