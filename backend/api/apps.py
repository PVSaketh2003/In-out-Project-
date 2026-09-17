"""
VisionEye API App Configuration and Global Pipeline Lifecycle Management
"""
import os
import atexit
import logging
from django.apps import AppConfig
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger("visioneye.apps")

_pipeline_instance = None


def get_pipeline(auto_start: bool = True):
    """Returns global VisionPipeline singleton."""
    global _pipeline_instance
    if _pipeline_instance is None:
        from vision.pipeline import VisionPipeline

        def broadcast_telemetry(data):
            try:
                channel_layer = get_channel_layer()
                if channel_layer is not None:
                    async_to_sync(channel_layer.group_send)(
                        "analytics_feed",
                        {
                            "type": "analytics_message",
                            "data": data,
                        },
                    )
            except Exception:
                pass

        model_path = os.getenv("MODEL_PATH", "backend/models/yolo26n.onnx")
        conf = float(os.getenv("CONFIDENCE_THRESHOLD", "0.40"))
        _pipeline_instance = VisionPipeline(
            model_path=model_path,
            conf_threshold=conf,
            broadcast_callback=broadcast_telemetry,
        )
        if auto_start:
            _pipeline_instance.start(source_type="synthetic")
        logger.info("[VisionEye] Pipeline initialized.")
    elif auto_start and not _pipeline_instance.video_source.is_running:
        _pipeline_instance.start(source_type=_pipeline_instance.video_source.source_type or "synthetic")

    return _pipeline_instance


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        """Initializes pipeline when Django ASGI starts."""
        import sys
        # Matches "daphne", "/usr/local/bin/daphne", "runserver", "uvicorn", etc.
        is_management = any(cmd in sys.argv for cmd in ["makemigrations", "migrate", "test", "collectstatic", "createsuperuser"])
        if not is_management:
            try:
                get_pipeline(auto_start=True)
            except Exception as e:
                logger.warning(f"[VisionEye] Pipeline auto-start deferred: {e}")

        atexit.register(self._cleanup)

    def _cleanup(self):
        global _pipeline_instance
        try:
            if _pipeline_instance is not None:
                _pipeline_instance.stop(silent=True)
                _pipeline_instance = None
        except Exception:
            pass

