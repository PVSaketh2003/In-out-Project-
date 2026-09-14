"""
Pytest configuration for VisionEye backend test suite.
Sets Django settings environment variable before tests run.
"""
import os

# Must be set before any Django imports
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.makedirs("media/uploads", exist_ok=True)
os.makedirs("data", exist_ok=True)
