"""
Unit tests for ByteTrack multi-person tracker.
"""
import time
import pytest
from vision.tracker import ByteTrack, STrack, TrackState


def test_tracker_single_track():
    tracker = ByteTrack(track_thresh=0.4, high_thresh=0.6)
    tracker.reset()
    det1 = {
        "bbox": [100.0, 100.0, 150.0, 200.0],
        "confidence": 0.9,
        "class_id": 0,
        "class_name": "person",
        "timestamp": time.time(),
    }
    tracks = tracker.update([det1])
    assert len(tracks) == 1
    t1 = tracks[0]
    assert t1.track_id == 1
    assert t1.state == TrackState.Tracked

    # Next frame slightly moved
    det2 = {
        "bbox": [102.0, 101.0, 152.0, 201.0],
        "confidence": 0.88,
        "class_id": 0,
        "class_name": "person",
        "timestamp": time.time(),
    }
    tracks_f2 = tracker.update([det2])
    assert len(tracks_f2) == 1
    # Track ID must remain stable
    assert tracks_f2[0].track_id == 1


def test_tracker_multiple_tracks():
    tracker = ByteTrack(track_thresh=0.4, high_thresh=0.6)
    dets = [
        {"bbox": [50.0, 50.0, 90.0, 150.0], "confidence": 0.9},
        {"bbox": [300.0, 100.0, 350.0, 220.0], "confidence": 0.85},
    ]
    tracks = tracker.update(dets)
    assert len(tracks) == 2
    ids = {t.track_id for t in tracks}
    assert len(ids) == 2
