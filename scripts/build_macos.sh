#!/usr/bin/env bash
# ==============================================================================
# Build macOS DMG Installer for VisionEye (Apple Silicon / Intel)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
DESKTOP_DIR="${ROOT_DIR}/desktop"
TARGET_ARCH="${1:-arm64}" # 'arm64' or 'x64'

echo "=============================================================================="
echo " Building VisionEye macOS Installer for Architecture: ${TARGET_ARCH}"
echo "=============================================================================="

# 1. Build frontend
bash "${SCRIPT_DIR}/build_frontend.sh"

# 2. Package desktop installer with Electron Builder
cd "${DESKTOP_DIR}"
npm install

if [ "${TARGET_ARCH}" = "arm64" ]; then
  npm run dist:mac-arm
elif [ "${TARGET_ARCH}" = "x64" ]; then
  npm run dist:mac-intel
else
  npm run dist:mac
fi

echo "=============================================================================="
echo " ✓ macOS Installer built successfully in: ${DESKTOP_DIR}/release"
echo "=============================================================================="
