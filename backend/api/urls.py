"""
API URL Routing
"""
from django.urls import path
from . import views
from . import auth_views
from . import download_views
from . import upload_views

urlpatterns = [
    # System Diagnostics & Streaming
    path("health", views.HealthCheckView.as_view(), name="api-health"),
    path("cameras", views.AvailableCamerasView.as_view(), name="api-cameras"),
    path("video/feed", views.video_feed_stream, name="api-video-feed"),
    path("video/frame", views.video_single_frame, name="api-video-frame"),
    path("video/client_frame", views.ClientFramePushView.as_view(), name="api-video-client-frame"),
    path("video/upload", views.VideoUploadView.as_view(), name="api-video-upload"),
    path("video/upload/init", upload_views.UploadInitView.as_view(), name="api-video-upload-init"),
    path("video/upload/chunk", upload_views.UploadChunkView.as_view(), name="api-video-upload-chunk"),
    path("video/upload/status/<str:upload_id>", upload_views.UploadStatusView.as_view(), name="api-video-upload-status"),
    path("video/upload/finalize", upload_views.UploadFinalizeView.as_view(), name="api-video-upload-finalize"),
    path("video/upload/cancel", upload_views.UploadCancelView.as_view(), name="api-video-upload-cancel"),
    path("video/test-rtsp", views.TestRTSPConnectionView.as_view(), name="api-video-test-rtsp"),
    path("video/<str:action>", views.VideoSourceControlView.as_view(), name="api-video-control"),
    path("config", views.ConfigView.as_view(), name="api-config"),
    path("counting-line", views.CountingLineView.as_view(), name="api-counting-line"),
    path("counting-line/flip", upload_views.CountingLineFlipView.as_view(), name="api-counting-line-flip"),
    path("perspective", views.PerspectiveView.as_view(), name="api-perspective"),
    path("analytics", views.AnalyticsView.as_view(), name="api-analytics"),
    path("analytics/reset", views.AnalyticsView.as_view(), name="api-analytics-reset"),
    path("tracking/reset", views.ResetTrackingView.as_view(), name="api-tracking-reset"),


    # Authentication & Email OTP (pvsaketh1@gmail.com)
    path("auth/send-otp", auth_views.SendOTPView.as_view(), name="api-auth-send-otp"),
    path("auth/verify-otp", auth_views.VerifyOTPView.as_view(), name="api-auth-verify-otp"),
    path("auth/session", auth_views.SessionStatusView.as_view(), name="api-auth-session"),
    path("auth/logout", auth_views.LogoutView.as_view(), name="api-auth-logout"),

    # Real Multi-Platform Application Downloads
    path("downloads/info", download_views.DownloadInfoView.as_view(), name="api-downloads-info"),
    path("downloads/<str:platform>", download_views.DownloadFileView.as_view(), name="api-downloads-file"),
]

