"""
VisionEye Visualization and Drawing Utilities
High-tech HUD, neon bounding boxes with per-person IN / OUT status indicators,
glowing counting lines, tracking trails, and on-frame real-time scoreboard.
"""
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import cv2

# Futuristic neon color palette (BGR)
COLOR_PALETTE = [
    (255, 240, 0),    # Neon Cyan (0, 240, 255 in RGB) -> BGR: (255, 240, 0)
    (0, 255, 128),    # Neon Emerald (128, 255, 0 in RGB)
    (255, 100, 0),    # Electric Blue
    (180, 0, 255),    # Magenta Pink
    (0, 215, 255),    # Amber Gold
    (255, 180, 50),   # Sky Blue
    (140, 255, 0),    # Spring Green
    (220, 0, 180),    # Violet Purple
]


def get_track_color(track_id: int) -> Tuple[int, int, int]:
    """Returns consistent neon BGR color for given track ID."""
    return COLOR_PALETTE[track_id % len(COLOR_PALETTE)]


def draw_hud_boxes(
    frame: np.ndarray,
    tracks: List[Any],
    draw_trails: bool = True,
    analytics: Optional[Any] = None,
) -> np.ndarray:
    """
    Renders sleek cyberpunk bounding boxes, person status badges (IN vs OUT), and trajectory trails.
    """
    h, w = frame.shape[:2]
    out = frame.copy()

    for track in tracks:
        track_id = track.track_id
        bbox = track.bbox
        conf = getattr(track, "confidence", 1.0)
        default_color = get_track_color(track_id)

        x1 = max(0, int(round(bbox[0])))
        y1 = max(0, int(round(bbox[1])))
        x2 = min(w, int(round(bbox[2])))
        y2 = min(h, int(round(bbox[3])))
        bx = int((x1 + x2) / 2)
        by = y2

        # 1. Determine Individual Person IN / OUT Status
        status_info = None
        if analytics is not None:
            status_info = analytics.get_track_status(track_id, (bx, by), w, h)

        if status_info:
            direction = status_info["status"]
            status_label = status_info["label"]
            box_color = status_info["color"]
            is_inside = status_info.get("is_inside", False)
        else:
            direction = "NEUTRAL"
            status_label = "ACTIVE"
            box_color = default_color
            is_inside = False

        # 2. Draw trajectory breadcrumbs
        if draw_trails and hasattr(track, "history"):
            hist_pts = list(track.history)
            for i in range(1, len(hist_pts)):
                p_prev = (int(hist_pts[i - 1][2]), int(hist_pts[i - 1][3]))
                p_curr = (int(hist_pts[i][2]), int(hist_pts[i][3]))
                alpha = i / len(hist_pts)
                thickness = max(1, int(alpha * 2))
                cv2.line(out, p_prev, p_curr, box_color, thickness, cv2.LINE_AA)

        # 3. Draw Corner Brackets (Sci-Fi HUD style)
        corner_len = min(18, max(8, (x2 - x1) // 4))
        thickness = 2

        # Top-Left
        cv2.line(out, (x1, y1), (x1 + corner_len, y1), box_color, thickness)
        cv2.line(out, (x1, y1), (x1, y1 + corner_len), box_color, thickness)
        # Top-Right
        cv2.line(out, (x2, y1), (x2 - corner_len, y1), box_color, thickness)
        cv2.line(out, (x2, y1), (x2, y1 + corner_len), box_color, thickness)
        # Bottom-Left
        cv2.line(out, (x1, y2), (x1 + corner_len, y2), box_color, thickness)
        cv2.line(out, (x1, y2), (x1, y2 - corner_len), box_color, thickness)
        # Bottom-Right
        cv2.line(out, (x2, y2), (x2 - corner_len, y2), box_color, thickness)
        cv2.line(out, (x2, y2), (x2, y2 - corner_len), box_color, thickness)

        # Subtle translucent bounding box outline
        cv2.rectangle(out, (x1, y1), (x2, y2), box_color, 1, cv2.LINE_AA)

        # 4. Floating Header Pill: Person IN / OUT Status Tag
        pill_text = f" {status_label} "
        (pw, ph), _ = cv2.getTextSize(pill_text, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
        pill_x1 = max(0, min(w - pw - 8, x1))
        pill_y2 = max(ph + 4, y1 - 4)
        pill_y1 = max(0, pill_y2 - ph - 6)
        pill_x2 = min(w, pill_x1 + pw + 8)

        # Draw status pill background
        if direction == "IN":
            bg_color = (10, 35, 20)
        elif direction == "OUT":
            bg_color = (35, 12, 20)
        else:
            bg_color = (15, 20, 28)

        cv2.rectangle(out, (pill_x1, pill_y1), (pill_x2, pill_y2), bg_color, -1)
        cv2.rectangle(out, (pill_x1, pill_y1), (pill_x2, pill_y2), box_color, 1, cv2.LINE_AA)
        cv2.putText(out, pill_text, (pill_x1 + 4, pill_y2 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.44, box_color, 1, cv2.LINE_AA)

        # 5. Track ID & Confidence Badge below head pill
        badge_label = f"ID #{track_id} | {conf:.2f}"
        (bw, bh), _ = cv2.getTextSize(badge_label, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
        badge_x1 = pill_x1
        badge_y1 = pill_y2 + 2
        badge_y2 = badge_y1 + bh + 4
        badge_x2 = min(w, badge_x1 + bw + 6)

        if badge_y2 < y2:
            cv2.rectangle(out, (badge_x1, badge_y1), (badge_x2, badge_y2), (10, 14, 20), -1)
            cv2.rectangle(out, (badge_x1, badge_y1), (badge_x2, badge_y2), (80, 90, 110), 1)
            cv2.putText(out, badge_label, (badge_x1 + 3, badge_y2 - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (230, 235, 245), 1, cv2.LINE_AA)

        # 6. Bottom-Center Ground Contact Dot
        cv2.circle(out, (bx, by), 4, box_color, -1, cv2.LINE_AA)
        cv2.circle(out, (bx, by), 7, box_color, 1, cv2.LINE_AA)

    return out


def draw_counting_line(
    frame: np.ndarray,
    p1: Tuple[int, int],
    p2: Tuple[int, int],
    total_in: int,
    total_out: int,
) -> np.ndarray:
    """
    Renders high-visibility virtual counting line with prominent IN/OUT side banners and directional arrows.
    """
    out = frame.copy()
    h, w = out.shape[:2]
    color_line = (0, 240, 255)  # Cyan glow
    color_in = (0, 255, 128)    # Emerald Green (IN)
    color_out = (60, 60, 245)   # Rose Red (OUT)

    # 1. Glow under-line
    cv2.line(out, p1, p2, (0, 120, 160), 6, cv2.LINE_AA)
    cv2.line(out, p1, p2, color_line, 2, cv2.LINE_AA)

    # End markers (A and B)
    cv2.circle(out, p1, 7, color_line, -1, cv2.LINE_AA)
    cv2.circle(out, p1, 10, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(out, "A", (p1[0] - 18, p1[1] + 5), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color_line, 1, cv2.LINE_AA)

    cv2.circle(out, p2, 7, color_line, -1, cv2.LINE_AA)
    cv2.circle(out, p2, 10, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(out, "B", (p2[0] + 8, p2[1] + 5), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color_line, 1, cv2.LINE_AA)

    # Midpoint & Normal Vectors
    mid_x = (p1[0] + p2[0]) // 2
    mid_y = (p1[1] + p2[1]) // 2

    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    length = max(1.0, float(np.hypot(dx, dy)))
    norm_x = -dy / length
    norm_y = dx / length

    # IN Vector (Entering side)
    arrow_dist = 40
    in_pt = (int(mid_x + norm_x * arrow_dist), int(mid_y + norm_y * arrow_dist))
    out_pt = (int(mid_x - norm_x * arrow_dist), int(mid_y - norm_y * arrow_dist))

    # Draw IN Direction Arrow & Prominent Badge
    cv2.arrowedLine(out, (mid_x, mid_y), in_pt, color_in, 3, cv2.LINE_AA, tipLength=0.35)
    in_label = f" IN DIRECTION (ENTERING) "
    (iw, ih), _ = cv2.getTextSize(in_label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    in_box_x = max(5, min(w - iw - 10, in_pt[0] - iw // 2))
    in_box_y = max(ih + 10, min(h - 10, in_pt[1]))
    cv2.rectangle(out, (in_box_x - 3, in_box_y - ih - 5), (in_box_x + iw + 3, in_box_y + 5), (10, 30, 20), -1)
    cv2.rectangle(out, (in_box_x - 3, in_box_y - ih - 5), (in_box_x + iw + 3, in_box_y + 5), color_in, 1)
    cv2.putText(out, in_label, (in_box_x, in_box_y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color_in, 1, cv2.LINE_AA)

    # Draw OUT Direction Arrow & Prominent Badge
    cv2.arrowedLine(out, (mid_x, mid_y), out_pt, color_out, 3, cv2.LINE_AA, tipLength=0.35)
    out_label = f" OUT DIRECTION (EXITING) "
    (ow, oh), _ = cv2.getTextSize(out_label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    out_box_x = max(5, min(w - ow - 10, out_pt[0] - ow // 2))
    out_box_y = max(oh + 10, min(h - 10, out_pt[1]))
    cv2.rectangle(out, (out_box_x - 3, out_box_y - oh - 5), (out_box_x + ow + 3, out_box_y + 5), (35, 12, 18), -1)
    cv2.rectangle(out, (out_box_x - 3, out_box_y - oh - 5), (out_box_x + ow + 3, out_box_y + 5), color_out, 1)
    cv2.putText(out, out_label, (out_box_x, out_box_y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (120, 140, 255), 1, cv2.LINE_AA)

    # Central Line Tag with Current Counts
    tag_label = f" COUNTING LINE | IN: {total_in} | OUT: {total_out} "
    (tw, th), _ = cv2.getTextSize(tag_label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
    tag_x = max(10, min(w - tw - 10, mid_x - tw // 2))
    tag_y = max(th + 6, min(h - 10, mid_y - 8))

    cv2.rectangle(out, (tag_x - 4, tag_y - th - 4), (tag_x + tw + 4, tag_y + 4), (10, 14, 22), -1)
    cv2.rectangle(out, (tag_x - 4, tag_y - th - 4), (tag_x + tw + 4, tag_y + 4), color_line, 1)
    cv2.putText(out, tag_label, (tag_x, tag_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

    return out


def draw_live_counter_hud(
    frame: np.ndarray,
    total_in: int,
    total_out: int,
    occupancy: int,
    active_people: int,
) -> np.ndarray:
    """
    Renders permanent, highly-visible on-frame scoreboard pills for IN, OUT, INSIDE, and ACTIVE counts.
    """
    out = frame.copy()
    h, w = out.shape[:2]

    # Scoreboard Pill dimensions
    pill_y = 20
    pill_h = 32

    # 1. Total IN Badge (Green)
    in_text = f"IN: {total_in}"
    in_w = 95
    in_x = 20
    cv2.rectangle(out, (in_x, pill_y), (in_x + in_w, pill_y + pill_h), (8, 30, 18), -1)
    cv2.rectangle(out, (in_x, pill_y), (in_x + in_w, pill_y + pill_h), (0, 255, 128), 2, cv2.LINE_AA)
    cv2.circle(out, (in_x + 14, pill_y + 16), 5, (0, 255, 128), -1, cv2.LINE_AA)
    cv2.putText(out, in_text, (in_x + 26, pill_y + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 128), 2, cv2.LINE_AA)

    # 2. Total OUT Badge (Rose Red)
    out_text = f"OUT: {total_out}"
    out_w = 105
    out_x = in_x + in_w + 10
    cv2.rectangle(out, (out_x, pill_y), (out_x + out_w, pill_y + pill_h), (35, 12, 20), -1)
    cv2.rectangle(out, (out_x, pill_y), (out_x + out_w, pill_y + pill_h), (60, 60, 245), 2, cv2.LINE_AA)
    cv2.circle(out, (out_x + 14, pill_y + 16), 5, (60, 60, 245), -1, cv2.LINE_AA)
    cv2.putText(out, out_text, (out_x + 26, pill_y + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (120, 140, 255), 2, cv2.LINE_AA)

    # 3. Inside / Occupancy Badge (Electric Cyan)
    occ_text = f"INSIDE: {occupancy}"
    occ_w = 120
    occ_x = out_x + out_w + 10
    cv2.rectangle(out, (occ_x, pill_y), (occ_x + occ_w, pill_y + pill_h), (10, 20, 30), -1)
    cv2.rectangle(out, (occ_x, pill_y), (occ_x + occ_w, pill_y + pill_h), (255, 240, 0), 2, cv2.LINE_AA)
    cv2.circle(out, (occ_x + 14, pill_y + 16), 5, (255, 240, 0), -1, cv2.LINE_AA)
    cv2.putText(out, occ_text, (occ_x + 26, pill_y + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 240, 0), 2, cv2.LINE_AA)

    # 4. Active People Badge (Gold)
    act_text = f"ACTIVE: {active_people}"
    act_w = 110
    act_x = occ_x + occ_w + 10
    if act_x + act_w < w - 20:
        cv2.rectangle(out, (act_x, pill_y), (act_x + act_w, pill_y + pill_h), (12, 20, 32), -1)
        cv2.rectangle(out, (act_x, pill_y), (act_x + act_w, pill_y + pill_h), (0, 215, 255), 1, cv2.LINE_AA)
        cv2.putText(out, act_text, (act_x + 10, pill_y + 21), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (0, 215, 255), 1, cv2.LINE_AA)

    return out


def draw_homography_overlay(
    frame: np.ndarray,
    norm_points: List[List[float]],
) -> np.ndarray:
    """
    Renders high-clarity 4-point homography calibration grid on ground plane.
    """
    h, w = frame.shape[:2]
    out = frame.copy()
    pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in norm_points], np.int32)
    pts_reshaped = pts.reshape((-1, 1, 2))

    # Translucent polygon fill
    overlay = out.copy()
    cv2.fillPoly(overlay, [pts_reshaped], (0, 180, 240))
    cv2.addWeighted(overlay, 0.20, out, 0.80, 0, out)

    # Perspective Grid lines inside polygon
    if len(pts) == 4:
        p_tl, p_tr, p_br, p_bl = pts
        # Draw 4 internal grid divisions
        for frac in [0.25, 0.5, 0.75]:
            top_pt = (int(p_tl[0] + (p_tr[0] - p_tl[0]) * frac), int(p_tl[1] + (p_tr[1] - p_tl[1]) * frac))
            bot_pt = (int(p_bl[0] + (p_br[0] - p_bl[0]) * frac), int(p_bl[1] + (p_br[1] - p_bl[1]) * frac))
            cv2.line(out, top_pt, bot_pt, (0, 200, 240), 1, cv2.LINE_AA)

            left_pt = (int(p_tl[0] + (p_bl[0] - p_tl[0]) * frac), int(p_tl[1] + (p_bl[1] - p_tl[1]) * frac))
            right_pt = (int(p_tr[0] + (p_br[0] - p_tr[0]) * frac), int(p_tr[1] + (p_br[1] - p_tr[1]) * frac))
            cv2.line(out, left_pt, right_pt, (0, 200, 240), 1, cv2.LINE_AA)

    # Outer polygon outline
    cv2.polylines(out, [pts_reshaped], isClosed=True, color=(0, 240, 255), thickness=2, lineType=cv2.LINE_AA)

    # Corner anchor dots & labels
    labels = ["1: TOP-LEFT (TL)", "2: TOP-RIGHT (TR)", "3: BOTTOM-RIGHT (BR)", "4: BOTTOM-LEFT (BL)"]
    for i, p in enumerate(norm_points):
        px = int(p[0] * w)
        py = int(p[1] * h)

        cv2.circle(out, (px, py), 8, (0, 255, 128), -1, cv2.LINE_AA)
        cv2.circle(out, (px, py), 12, (255, 255, 255), 2, cv2.LINE_AA)

        (lw, lh), _ = cv2.getTextSize(labels[i], cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        tag_x = max(5, min(w - lw - 10, px + 12))
        tag_y = max(lh + 5, min(h - 5, py - 5))

        cv2.rectangle(out, (tag_x - 2, tag_y - lh - 2), (tag_x + lw + 2, tag_y + 2), (10, 16, 25), -1)
        cv2.rectangle(out, (tag_x - 2, tag_y - lh - 2), (tag_x + lw + 2, tag_y + 2), (0, 255, 128), 1)
        cv2.putText(out, labels[i], (tag_x, tag_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 128), 1, cv2.LINE_AA)

    # Calibration Banner at Top
    banner = " [ TOP-VIEW PERSPECTIVE CALIBRATION ACTIVE ] "
    (bw, bh), _ = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    banner_y = h - 25
    cv2.rectangle(out, (w // 2 - bw // 2 - 6, banner_y - bh - 6), (w // 2 + bw // 2 + 6, banner_y + 6), (10, 14, 25), -1)
    cv2.rectangle(out, (w // 2 - bw // 2 - 6, banner_y - bh - 6), (w // 2 + bw // 2 + 6, banner_y + 6), (0, 240, 255), 1)
    cv2.putText(out, banner, (w // 2 - bw // 2, banner_y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 240, 255), 1, cv2.LINE_AA)

    return out
