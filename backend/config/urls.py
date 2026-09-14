"""
URL configuration for VisionEye backend.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from api.views import serve_react_app

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    # Universal React SPA & PWA routes
    path("", serve_react_app, name="spa-root"),
    path("live", serve_react_app, name="spa-live"),
    path("live/", serve_react_app, name="spa-live-slash"),
    path("app", serve_react_app, name="spa-app"),
    path("app/", serve_react_app, name="spa-app-slash"),
    re_path(r"^assets/(?P<path>.*)$", lambda req, path: serve_react_app(req, f"assets/{path}"), name="spa-assets"),
    re_path(r"^(?P<path>manifest\.webmanifest|manifest\.json|sw\.js|favicon\.ico|apple-touch-icon.*\.png|icon-.*\.png)$", serve_react_app, name="spa-pwa-assets"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

