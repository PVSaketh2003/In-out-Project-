#!/usr/bin/env bash
# ==============================================================================
# Build Linux AppImage / Debian Package for VisionEye
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
DESKTOP_DIR="${ROOT_DIR}/desktop"

echo "=============================================================================="
echo " Building VisionEye Linux AppImage Installer (x86_64)"
echo "=============================================================================="

# 1. Build frontend
bash "${SCRIPT_DIR}/build_frontend.sh"

# 2. Package desktop installer
cd "${DESKTOP_DIR}"
npm install
npm run dist:linux

echo "=============================================================================="
echo " ✓ Linux AppImage built successfully in: ${DESKTOP_DIR}/release"
echo "=============================================================================="
