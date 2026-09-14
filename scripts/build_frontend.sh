#!/usr/bin/env bash
# ==============================================================================
# Build Frontend Script for VisionEye Desktop Packaging
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
FRONTEND_DIR="${ROOT_DIR}/frontend"
DESKTOP_DIR="${ROOT_DIR}/desktop"

echo "==> Building React/Vite Frontend..."
cd "${FRONTEND_DIR}"
npm install
npm run build

echo "==> Copying frontend distribution to desktop/dist-frontend..."
mkdir -p "${DESKTOP_DIR}/dist-frontend"
rm -rf "${DESKTOP_DIR}/dist-frontend/*"
cp -R "${FRONTEND_DIR}/dist/"* "${DESKTOP_DIR}/dist-frontend/"

echo "✓ Frontend build ready for desktop packaging."
