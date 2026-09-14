"""
Unit tests for foot-traffic analytics and virtual counting line crossing.
"""
import time
import pytest
from vision.analytics import FootTrafficAnalytics
from vision.tracker import STrack


def test_analytics_crossing_in():
    analytics = FootTrafficAnalytics(line_start=(0.0, 0.5), line_end=(1.0, 0.5))
    w, h = 640, 480

    # Frame 1: Person at y=200 (above horizontal line at y=240, side < 0)
    det1 = {"bbox": [300.0, 100.0, 340.0, 200.0], "confidence": 0.9}
    track = STrack(det1, track_id=101)

    events_1 = analytics.process_tracks([track], w, h)
    assert len(events_1) == 0
    assert analytics.occupancy == 0

    # Frame 2: Person moves to y=280 (below line at y=240, crossed downwards -> IN)
    time.sleep(0.01)
    det2 = {"bbox": [300.0, 180.0, 340.0, 280.0], "confidence": 0.9}
    track.update(det2, frame_id=2)

    events_2 = analytics.process_tracks([track], w, h)
    assert len(events_2) == 1
    assert events_2[0]["direction"] == "IN"
    assert analytics.total_in == 1
    assert analytics.occupancy == 1


def test_analytics_crossing_out_and_occupancy():
    analytics = FootTrafficAnalytics(line_start=(0.0, 0.5), line_end=(1.0, 0.5))
    w, h = 640, 480

    # Person starts at y=300 (below line)
    det1 = {"bbox": [200.0, 200.0, 240.0, 300.0], "confidence": 0.9}
    track = STrack(det1, track_id=202)
    analytics.process_tracks([track], w, h)

    # Moves to y=180 (crosses upwards -> OUT)
    time.sleep(0.01)
    det2 = {"bbox": [200.0, 80.0, 240.0, 180.0], "confidence": 0.9}
    track.update(det2, frame_id=2)

    events = analytics.process_tracks([track], w, h)
    assert len(events) == 1
    assert events[0]["direction"] == "OUT"
    assert analytics.total_out == 1
    # Occupancy is clamped at 0 (never negative)
    assert analytics.occupancy == 0
