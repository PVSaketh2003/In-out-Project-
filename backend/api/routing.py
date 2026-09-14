"""
WebSocket URL routing for Channels.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"^ws/analytics/?$", consumers.AnalyticsConsumer.as_asgi()),
]
