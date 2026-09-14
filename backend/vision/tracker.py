"""
VisionEye ByteTrack Multi-Person Tracker
High-speed, stable ID assignment using Kalman Filter and Hungarian IoU matching.
"""
import enum
import time
from collections import deque
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from scipy.optimize import linear_sum_assignment


class TrackState(enum.Enum):
    New = 0
    Tracked = 1
    Lost = 2
    Removed = 3


class KalmanBoxTracker:
    """
    Kalman filter tracking bounding box state:
    [x, y, w, h, vx, vy, vw, vh]
    """

    def __init__(self, bbox: List[float]):
        # State: [x, y, w, h, vx, vy, vw, vh]
        x1, y1, x2, y2 = bbox
        w = max(1.0, x2 - x1)
        h = max(1.0, y2 - y1)
        cx = x1 + w / 2.0
        cy = y1 + h / 2.0

        self.state = np.array([cx, cy, w, h, 0.0, 0.0, 0.0, 0.0], dtype=np.float32)

        # State transition matrix (dt = 1)
        self.F = np.eye(8, dtype=np.float32)
        for i in range(4):
            self.F[i, i + 4] = 1.0

        # Measurement matrix (observing cx, cy, w, h)
        self.H = np.zeros((4, 8), dtype=np.float32)
        for i in range(4):
            self.H[i, i] = 1.0

        # Covariance matrices
        self.P = np.diag([10.0, 10.0, 10.0, 10.0, 1000.0, 1000.0, 1000.0, 1000.0]).astype(np.float32)
        self.Q = np.diag([1.0, 1.0, 1.0, 1.0, 0.01, 0.01, 0.01, 0.01]).astype(np.float32)
        self.R = np.diag([1.0, 1.0, 10.0, 10.0]).astype(np.float32)

    def predict(self) -> np.ndarray:
        """Predicts next state."""
        self.state = np.dot(self.F, self.state)
        self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q
        return self.get_bbox()

    def update(self, bbox: List[float]):
        """Updates filter with measurement."""
        x1, y1, x2, y2 = bbox
        w = max(1.0, x2 - x1)
        h = max(1.0, y2 - y1)
        cx = x1 + w / 2.0
        cy = y1 + h / 2.0
        z = np.array([cx, cy, w, h], dtype=np.float32)

        y = z - np.dot(self.H, self.state)
        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))

        self.state = self.state + np.dot(K, y)
        self.P = self.P - np.dot(np.dot(K, self.H), self.P)

    def get_bbox(self) -> List[float]:
        """Returns predicted [x1, y1, x2, y2]."""
        cx, cy, w, h = self.state[:4]
        w = max(1.0, float(w))
        h = max(1.0, float(h))
        return [float(cx - w / 2.0), float(cy - h / 2.0), float(cx + w / 2.0), float(cy + h / 2.0)]


class STrack:
    """Single tracked entity with trajectory history."""

    _count = 0

    def __init__(self, detection: Dict[str, Any], track_id: Optional[int] = None):
        if track_id is None:
            STrack._count += 1
            self.track_id = STrack._count
        else:
            self.track_id = track_id

        self.bbox = detection["bbox"]
        self.confidence = detection.get("confidence", 1.0)
        self.class_id = detection.get("class_id", 0)
        self.class_name = detection.get("class_name", "person")
        self.kalman = KalmanBoxTracker(self.bbox)

        self.state = TrackState.New
        self.is_activated = False
        self.frame_id = 0
        self.tracklet_len = 0
        self.time_since_update = 0

        # Trajectory history: deque of (center_x, center_y, bottom_x, bottom_y, timestamp)
        self.history = deque(maxlen=45)
        self._record_position(self.bbox, detection.get("timestamp", time.time()))

    @property
    def center(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return (x1 + x2) / 2.0, (y1 + y2) / 2.0

    @property
    def bottom_center(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return (x1 + x2) / 2.0, y2

    def _record_position(self, bbox: List[float], timestamp: float):
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        bx = cx
        by = y2
        self.history.append((cx, cy, bx, by, timestamp))

    def predict(self):
        predicted_box = self.kalman.predict()
        self.bbox = predicted_box
        self.time_since_update += 1

    def update(self, new_detection: Dict[str, Any], frame_id: int):
        self.frame_id = frame_id
        self.tracklet_len += 1
        self.time_since_update = 0
        self.bbox = new_detection["bbox"]
        self.confidence = new_detection.get("confidence", self.confidence)
        self.kalman.update(self.bbox)
        self.state = TrackState.Tracked
        self.is_activated = True
        self._record_position(self.bbox, new_detection.get("timestamp", time.time()))

    def mark_lost(self):
        self.state = TrackState.Lost

    def mark_removed(self):
        self.state = TrackState.Removed

    def to_dict(self) -> Dict[str, Any]:
        cx, cy = self.center
        bx, by = self.bottom_center
        # Return recent trajectory points
        trail = [{"x": p[0], "y": p[1], "bx": p[2], "by": p[3]} for p in list(self.history)[-15:]]
        return {
            "track_id": self.track_id,
            "class_id": self.class_id,
            "class_name": self.class_name,
            "confidence": round(float(self.confidence), 3),
            "bbox": [round(v, 1) for v in self.bbox],
            "center": [round(cx, 1), round(cy, 1)],
            "bottom_center": [round(bx, 1), round(by, 1)],
            "tracklet_len": self.tracklet_len,
            "state": self.state.name,
            "trail": trail,
        }


def bbox_iou(box1: List[float], box2: List[float]) -> float:
    """Computes Intersection over Union (IoU) between two bounding boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_w = max(0.0, x2 - x1)
    inter_h = max(0.0, y2 - y1)
    inter_area = inter_w * inter_h

    area1 = max(0.0, box1[2] - box1[0]) * max(0.0, box1[3] - box1[1])
    area2 = max(0.0, box2[2] - box2[0]) * max(0.0, box2[3] - box2[1])
    union_area = area1 + area2 - inter_area + 1e-6

    return inter_area / union_area


class ByteTrack:
    """
    ByteTrack implementation for multi-person tracking.
    """

    def __init__(
        self,
        track_thresh: float = 0.40,
        high_thresh: float = 0.60,
        match_thresh: float = 0.80,
        max_time_lost: int = 30,
    ):
        self.track_thresh = track_thresh
        self.high_thresh = high_thresh
        self.match_thresh = match_thresh  # IoU distance threshold (1 - IoU)
        self.max_time_lost = max_time_lost

        self.tracked_stracks: List[STrack] = []
        self.lost_stracks: List[STrack] = []
        self.removed_stracks: List[STrack] = []
        self.frame_id = 0

    def reset(self):
        """Resets all active and history tracks."""
        self.tracked_stracks.clear()
        self.lost_stracks.clear()
        self.removed_stracks.clear()
        self.frame_id = 0
        STrack._count = 0

    def update(self, detections: List[Dict[str, Any]]) -> List[STrack]:
        """
        Updates tracker state with new frame detections.
        Returns list of active STrack objects.
        """
        self.frame_id += 1

        # Predict Kalman state for all existing tracks
        for track in self.tracked_stracks:
            track.predict()
        for track in self.lost_stracks:
            track.predict()

        # Partition detections into high and low score sets
        det_high = []
        det_low = []
        for det in detections:
            if det.get("confidence", 1.0) >= self.high_thresh:
                det_high.append(det)
            elif det.get("confidence", 1.0) >= self.track_thresh:
                det_low.append(det)

        # 1st association: High score detections with active tracked tracks
        matched_tracks_1, unmatched_det_high, unmatched_tracks_1 = self._associate(
            self.tracked_stracks, det_high, max_dist=self.match_thresh
        )

        for track, det in matched_tracks_1:
            track.update(det, self.frame_id)

        # 2nd association: Remaining high score tracks + lost tracks with low score detections
        candidates_2 = [t for t in unmatched_tracks_1 if t.state == TrackState.Tracked] + self.lost_stracks
        matched_tracks_2, unmatched_det_low, unmatched_tracks_2 = self._associate(
            candidates_2, det_low, max_dist=0.5
        )

        for track, det in matched_tracks_2:
            track.update(det, self.frame_id)
            if track in self.lost_stracks:
                self.lost_stracks.remove(track)
                self.tracked_stracks.append(track)

        # Process unmatched tracks
        for track in unmatched_tracks_2:
            if track.state == TrackState.Tracked:
                track.mark_lost()
                if track not in self.lost_stracks:
                    self.lost_stracks.append(track)

        # Activate new tracks from unmatched high confidence detections
        for det in unmatched_det_high:
            new_track = STrack(det)
            new_track.state = TrackState.Tracked
            new_track.is_activated = True
            new_track.frame_id = self.frame_id
            self.tracked_stracks.append(new_track)

        # Purge lost tracks that exceeded max_time_lost
        for track in list(self.lost_stracks):
            if track.time_since_update > self.max_time_lost:
                track.mark_removed()
                self.lost_stracks.remove(track)
                self.removed_stracks.append(track)

        # Filter active tracked list
        self.tracked_stracks = [t for t in self.tracked_stracks if t.state == TrackState.Tracked]

        return self.tracked_stracks

    def _associate(
        self,
        tracks: List[STrack],
        detections: List[Dict[str, Any]],
        max_dist: float = 0.8,
    ) -> Tuple[List[Tuple[STrack, Dict[str, Any]]], List[Dict[str, Any]], List[STrack]]:
        """
        Associates tracks with detections using Hungarian algorithm on IoU cost matrix.
        """
        if len(tracks) == 0:
            return [], detections, []
        if len(detections) == 0:
            return [], [], tracks

        # Compute cost matrix: (1.0 - IoU)
        cost_matrix = np.zeros((len(tracks), len(detections)), dtype=np.float32)
        for i, track in enumerate(tracks):
            for j, det in enumerate(detections):
                iou = bbox_iou(track.bbox, det["bbox"])
                cost_matrix[i, j] = 1.0 - iou

        row_ind, col_ind = linear_sum_assignment(cost_matrix)

        matched = []
        unmatched_tracks = set(range(len(tracks)))
        unmatched_dets = set(range(len(detections)))

        for r, c in zip(row_ind, col_ind):
            if cost_matrix[r, c] <= max_dist:
                matched.append((tracks[r], detections[c]))
                unmatched_tracks.discard(r)
                unmatched_dets.discard(c)

        unmatched_track_objs = [tracks[i] for i in unmatched_tracks]
        unmatched_det_objs = [detections[j] for j in unmatched_dets]

        return matched, unmatched_det_objs, unmatched_track_objs
