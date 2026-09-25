"""
VisionEye Foot-Traffic Analytics Module
IN/OUT Virtual Counting Line, Crossing Debouncing, Occupancy Calculation,
and Per-Person IN / OUT State Tracking.
"""
import time
import logging
from collections import deque
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

logger = logging.getLogger("visioneye.analytics")


def ccw(A: Tuple[float, float], B: Tuple[float, float], C: Tuple[float, float]) -> bool:
    """Returns True if points A, B, C are in counter-clockwise order."""
    return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])


def segments_intersect(
    p1: Tuple[float, float],
    p2: Tuple[float, float],
    p3: Tuple[float, float],
    p4: Tuple[float, float],
) -> bool:
    """Checks if line segment p1-p2 intersects line segment p3-p4."""
    return (ccw(p1, p3, p4) != ccw(p2, p3, p4)) and (ccw(p1, p2, p3) != ccw(p1, p2, p4))


class FootTrafficAnalytics:
    """
    Manages counting lines, directional crossings, occupancy, and telemetry.
    Stores line coordinates in normalized [0.0, 1.0] space.
    """

    def __init__(
        self,
        line_start: Tuple[float, float] = (0.15, 0.72),
        line_end: Tuple[float, float] = (0.85, 0.48),
    ):
        # Normalized coordinates [0.0 - 1.0] (Default from corner across entrance)
        self.norm_line_start = list(line_start)
        self.norm_line_end = list(line_end)

        self.total_in = 0
        self.total_out = 0
        self.occupancy = 0
        self.active_people_count = 0

        # Debouncing dictionary: track_id -> dict(last_side, last_event_time, last_pos, last_crossed_direction)
        self.track_crossing_state: Dict[int, Dict[str, Any]] = {}

        # Recent crossing events (for UI alerts & timeline)
        self.recent_events: deque = deque(maxlen=50)

        # Flow rate timeline (samples every second)
        self.flow_history: deque = deque(maxlen=60)
        self.last_history_sample_time = time.time()

    def set_counting_line(self, start_pt: Tuple[float, float], end_pt: Tuple[float, float]):
        """
        Updates the virtual counting line coordinates.
        Accepts normalized [0.0, 1.0] coordinates.
        """
        self.norm_line_start = [
            max(0.0, min(1.0, float(start_pt[0]))),
            max(0.0, min(1.0, float(start_pt[1]))),
        ]
        self.norm_line_end = [
            max(0.0, min(1.0, float(end_pt[0]))),
            max(0.0, min(1.0, float(end_pt[1]))),
        ]
        logger.info(f"[Analytics] Counting line updated: {self.norm_line_start} -> {self.norm_line_end}")

    def get_absolute_line(self, width: int, height: int) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """Converts normalized line coordinates to absolute pixel coordinates."""
        p1 = (int(self.norm_line_start[0] * width), int(self.norm_line_start[1] * height))
        p2 = (int(self.norm_line_end[0] * width), int(self.norm_line_end[1] * height))
        return p1, p2

    def reset_counts(self):
        """Resets all IN/OUT and occupancy counters."""
        self.total_in = 0
        self.total_out = 0
        self.occupancy = 0
        self.track_crossing_state.clear()
        self.recent_events.clear()
        logger.info("[Analytics] Counters reset to 0.")

    def _get_point_side(
        self,
        pt: Tuple[float, float],
        line_p1: Tuple[float, float],
        line_p2: Tuple[float, float],
    ) -> float:
        """
        Computes the signed cross product distance of a point relative to the line vector.
        > 0 means one side (e.g. IN side), < 0 means the opposite side (OUT side).
        """
        return (line_p2[0] - line_p1[0]) * (pt[1] - line_p1[1]) - (line_p2[1] - line_p1[1]) * (pt[0] - line_p1[0])

    def get_track_status(
        self,
        track_id: int,
        curr_pos: Tuple[float, float],
        frame_width: int,
        frame_height: int,
    ) -> Dict[str, Any]:
        """
        Returns real-time IN / OUT classification for an individual person.
        """
        p1, p2 = self.get_absolute_line(frame_width, frame_height)
        state = self.track_crossing_state.get(track_id)
        
        last_dir = state.get("last_crossed_direction") if state else None
        side = self._get_point_side(curr_pos, p1, p2)
        
        if last_dir == "IN":
            return {"status": "IN", "label": "ENTERED IN", "color": (0, 255, 128), "is_inside": True}
        elif last_dir == "OUT":
            return {"status": "OUT", "label": "EXITED OUT", "color": (60, 60, 245), "is_inside": False}
        elif side > 0:
            return {"status": "IN", "label": "INSIDE", "color": (0, 255, 128), "is_inside": True}
        else:
            return {"status": "OUT", "label": "OUTSIDE", "color": (60, 60, 245), "is_inside": False}

    def process_tracks(
        self,
        tracks: List[Any],
        frame_width: int,
        frame_height: int,
    ) -> List[Dict[str, Any]]:
        """
        Processes active STrack objects against the virtual counting line.
        Returns list of crossing events in this frame.
        """
        self.active_people_count = len(tracks)
        p1, p2 = self.get_absolute_line(frame_width, frame_height)

        line_len = np.hypot(p2[0] - p1[0], p2[1] - p1[1]) + 1e-6
        new_events = []
        now = time.time()

        for track in tracks:
            track_id = track.track_id
            history = list(track.history)
            if len(history) < 2:
                continue

            # Use bottom-center (bx, by) as ground contact point
            curr_bx, curr_by = history[-1][2], history[-1][3]
            prev_bx, prev_by = history[-2][2], history[-2][3]

            curr_pos = (curr_bx, curr_by)
            prev_pos = (prev_bx, prev_by)

            # Compute sides
            side_curr = self._get_point_side(curr_pos, p1, p2)
            side_prev = self._get_point_side(prev_pos, p1, p2)

            state = self.track_crossing_state.get(track_id)
            if state is None:
                # Initialize track state from previous point
                initial_side = 1 if side_prev >= 0 else -1
                state = {
                    "last_side": initial_side,
                    "last_crossing_time": 0.0,
                    "last_crossed_direction": None,
                }
                self.track_crossing_state[track_id] = state

            last_side = state["last_side"]
            last_time = state["last_crossing_time"]

            # Check if trajectory intersects virtual line
            has_intersected = segments_intersect(prev_pos, curr_pos, p1, p2)
            side_changed = (side_prev * side_curr < 0) or ((side_curr >= 0 and last_side < 0) or (side_curr < 0 and last_side > 0))

            # Debounce: ensure at least 1.0 seconds or clear crossing before duplicate trigger
            time_since_crossing = now - last_time

            if (has_intersected or side_changed) and time_since_crossing > 1.0:
                direction = None
                # Moving from negative to positive side -> IN
                if side_curr > 0 and (side_prev < 0 or last_side < 0):
                    direction = "IN"
                    self.total_in += 1
                # Moving from positive to negative side -> OUT
                elif side_curr < 0 and (side_prev > 0 or last_side > 0):
                    direction = "OUT"
                    self.total_out += 1

                if direction:
                    # Maintain occupancy >= 0
                    self.occupancy = max(0, self.total_in - self.total_out)

                    event = {
                        "id": f"evt-{int(now * 1000)}-{track_id}",
                        "timestamp": now,
                        "time_str": time.strftime("%H:%M:%S", time.localtime(now)),
                        "track_id": track_id,
                        "direction": direction,
                        "occupancy": self.occupancy,
                        "position": [round(curr_bx, 1), round(curr_by, 1)],
                    }
                    self.recent_events.appendleft(event)
                    new_events.append(event)

                    # Update state
                    state["last_side"] = 1 if side_curr >= 0 else -1
                    state["last_crossing_time"] = now
                    state["last_crossed_direction"] = direction
                    logger.info(
                        f"[Analytics Event] Track #{track_id} crossed {direction}. "
                        f"Occupancy: {self.occupancy} (IN: {self.total_in}, OUT: {self.total_out})"
                    )

            # Update last known side if distance is clear
            if abs(side_curr) / line_len > 0.02:
                state["last_side"] = 1 if side_curr >= 0 else -1

        # Periodic flow rate sampling
        if now - self.last_history_sample_time >= 1.0:
            self.last_history_sample_time = now
            self.flow_history.append({
                "timestamp": now,
                "time": time.strftime("%H:%M:%S", time.localtime(now)),
                "occupancy": self.occupancy,
                "in": self.total_in,
                "out": self.total_out,
                "active": self.active_people_count,
            })

        return new_events

    def get_telemetry(self) -> Dict[str, Any]:
        """Returns snapshot telemetry for WebSocket and REST APIs."""
        return {
            "occupancy": self.occupancy,
            "total_in": self.total_in,
            "total_out": self.total_out,
            "active_people": self.active_people_count,
            "counting_line": {
                "start": self.norm_line_start,
                "end": self.norm_line_end,
            },
            "recent_events": list(self.recent_events)[:10],
            "flow_history": list(self.flow_history)[-30:],
        }
