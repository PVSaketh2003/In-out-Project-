#!/usr/bin/env bash
# ==============================================================================
# Generate SHA256SUMS for all release installer binaries
# ==============================================================================
set -e

RELEASE_DIR="${1:-./release}"
OUTPUT_FILE="${RELEASE_DIR}/SHA256SUMS.txt"

if [ ! -d "${RELEASE_DIR}" ]; then
  echo "Error: Release directory '${RELEASE_DIR}' does not exist."
  exit 1
fi

echo "==> Generating SHA256 Checksums for release artifacts in: ${RELEASE_DIR}..."
cd "${RELEASE_DIR}"
rm -f SHA256SUMS.txt

if command -v sha256sum &>/dev/null; then
  sha256sum *.{dmg,exe,AppImage,deb,zip,tar.gz} 2>/dev/null > SHA256SUMS.txt || true
elif command -v shasum &>/dev/null; then
  shasum -a 256 *.{dmg,exe,AppImage,deb,zip,tar.gz} 2>/dev/null > SHA256SUMS.txt || true
fi

echo "=============================================================================="
echo " SHA-256 Checksums:"
echo "=============================================================================="
cat SHA256SUMS.txt || echo "(No matching installer binaries found in ${RELEASE_DIR})"
echo "=============================================================================="
