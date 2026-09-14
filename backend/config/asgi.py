"""
ASGI config for VisionEye project.
Exposes ASGI application for Daphne / Uvicorn with WebSocket ProtocolTypeRouter.
"""
import os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import api.routing

application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        "websocket": AuthMiddlewareStack(
            URLRouter(
                api.routing.websocket_urlpatterns
            )
        ),
    }
)
