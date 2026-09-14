"""
Unit tests for 4-point homography perspective transformer.
"""
import pytest
from vision.perspective import TopViewTransformer
from vision.tracker import STrack


def test_perspective_homography():
    transformer = TopViewTransformer(
        source_points=[[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
        canvas_width=400,
        canvas_height=400,
    )
    # Midpoint of 640x480 frame -> midpoint of 400x400 top-view
    pt = transformer.transform_point((320, 240), 640, 480)
    assert pt is not None
    top_x, top_y = pt
    assert abs(top_x - 200.0) < 5.0
    assert abs(top_y - 200.0) < 5.0


def test_perspective_track_transformation():
    transformer = TopViewTransformer(canvas_width=500, canvas_height=500)
    track = STrack({"bbox": [100.0, 200.0, 160.0, 300.0], "confidence": 0.9}, track_id=5)
    entities = transformer.transform_tracks([track], 640, 480)
    assert len(entities) == 1
    assert entities[0]["track_id"] == 5
    assert "x" in entities[0]
    assert "y" in entities[0]
