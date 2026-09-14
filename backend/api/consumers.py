"""
VisionEye Channels Async WebSocket Consumer
Pushes real-time telemetry, track data, occupancy counts, and latency stats to frontend.
Receives real-time interactive commands from frontend.
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from .apps import get_pipeline

logger = logging.getLogger("visioneye.websocket")


class AnalyticsConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer handling real-time foot traffic telemetry and client actions.
    Route: ws://<host>:<port>/ws/analytics/
    """

    async def connect(self):
        self.room_group_name = "analytics_feed"

        # Join group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        logger.info(f"[WebSocket] Client connected: {self.channel_name}")

        # Send initial snapshot immediately
        pipeline = get_pipeline()
        initial_telemetry = pipeline.get_latest_telemetry()
        if initial_telemetry:
            await self.send(text_data=json.dumps({
                "type": "telemetry",
                "data": initial_telemetry,
            }))

    async def disconnect(self, close_code):
        # Leave group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        logger.info(f"[WebSocket] Client disconnected: {self.channel_name} (code: {close_code})")

    async def receive(self, text_data=None, bytes_data=None):
        """Handles commands sent from React client via WebSocket."""
        if not text_data:
            return

        try:
            msg = json.loads(text_data)
            action = msg.get("action")
            pipeline = get_pipeline()

            if action == "set_confidence":
                conf = float(msg.get("value", 0.40))
                pipeline.set_confidence(conf)
                await self.send(text_data=json.dumps({"status": "ok", "message": f"Confidence set to {conf}"}))

            elif action == "set_privacy":
                mode = msg.get("mode", "blur")
                enabled = bool(msg.get("enabled", True))
                pipeline.set_privacy(mode, enabled)
                await self.send(text_data=json.dumps({"status": "ok", "message": f"Privacy {mode} set to {enabled}"}))

            elif action == "set_counting_line":
                start_pt = msg.get("start") or msg.get("start_pt")
                end_pt = msg.get("end") or msg.get("end_pt")
                if start_pt and end_pt:
                    pipeline.set_counting_line(start_pt, end_pt)
                    await self.send(text_data=json.dumps({"status": "ok", "message": "Counting line updated"}))

            elif action == "set_perspective":
                points = msg.get("points")
                if points and len(points) == 4:
                    pipeline.set_perspective(points)
                    await self.send(text_data=json.dumps({"status": "ok", "message": "Perspective calibrated"}))

            elif action == "auto_calibrate":
                pts = pipeline.auto_calibrate_perspective()
                await self.send(text_data=json.dumps({"status": "ok", "message": "Auto-calibrated ground plane", "points": pts}))

            elif action == "set_perspective_preset":
                preset = msg.get("preset", "floor")
                pts = pipeline.set_perspective_preset(preset)
                await self.send(text_data=json.dumps({"status": "ok", "message": f"Applied {preset} preset", "points": pts}))

            elif action == "set_calibration_mode":
                mode = msg.get("mode")
                pipeline.set_calibration_mode(mode)

            elif action == "reset_analytics":
                pipeline.reset_analytics()
                await self.send(text_data=json.dumps({"status": "ok", "message": "Analytics reset"}))

            elif action == "reset_tracking":
                pipeline.reset_tracking()
                await self.send(text_data=json.dumps({"status": "ok", "message": "Tracker reset"}))

            elif action == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))

        except Exception as e:
            logger.error(f"[WebSocket] Error processing client message: {e}", exc_info=True)
            await self.send(text_data=json.dumps({"status": "error", "message": str(e)}))

    async def analytics_message(self, event):
        """Handler for group messages sent from vision pipeline."""
        data = event.get("data")
        if data:
            await self.send(text_data=json.dumps({
                "type": "telemetry",
                "data": data,
            }))
