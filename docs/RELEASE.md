# VisionEye Multi-Platform Release & Versioning Playbook

This document details the release management workflow, semantic versioning principles, GitHub Actions packaging matrix, and SHA-256 checksum verification.

---

## 1. Semantic Versioning Specification

VisionEye strictly follows [Semantic Versioning 2.0.0](https://semver.org/):

```text
v<MAJOR>.<MINOR>.<PATCH>
```

- **MAJOR** (`v1.0.0 -> v2.0.0`): Breaking architectural revisions, major protocol modifications, or full UI redesigns.
- **MINOR** (`v1.0.0 -> v1.1.0`): New computer vision models, additional tracking features, new export analytics, or camera hardware drivers.
- **PATCH** (`v1.0.0 -> v1.0.1`): Bug fixes, memory optimizations, UI styling improvements, or security updates.

---

## 2. Release Triggering Workflow

Releasing a new version requires **zero manual file uploads**. Everything is automated through GitHub Actions.

### Step 1: Ensure All Local Tests Pass
```bash
# Run backend pytest suite (13/13 tests)
PYTHONPATH=backend pytest backend/tests/ -v

# Run frontend build check
cd frontend && npm run build
```

### Step 2: Tag the Release and Push
```bash
# Create annotated Git tag
git tag -a v1.0.0 -m "VisionEye Release v1.0.0: Production Edge Computer Vision & Analytics Platform"

# Push tag to GitHub
git push origin v1.0.0
```

---

## 3. What Happens Automatically on Tag Push

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which executes:

1. **Multi-OS Installer Compilation Matrix**:
   - `macos-14` runner: Packages Apple Silicon ARM64 DMG (`VisionEye-macOS-AppleSilicon.dmg`).
   - `macos-13` runner: Packages Intel x86_64 DMG (`VisionEye-macOS-Intel.dmg`).
   - `windows-latest` runner: Packages 64-bit NSIS executable (`VisionEye-Windows-x64.exe`).
   - `ubuntu-latest` runner: Packages Linux AppImage (`VisionEye-Linux-x64.AppImage`) and `.deb`.
2. **SHA-256 Checksum Generation**:
   - Generates `SHA256SUMS.txt` listing the cryptographic hash of each compiled binary.
3. **GitHub Release Publication**:
   - Creates the public GitHub Release with release notes and attaches all compiled binaries.
4. **Download Portal Auto-Deployment**:
   - Deploys `website/` to GitHub Pages under `https://pvsairamsaketh.in`.
   - The portal immediately queries the GitHub API and presents the new version and downloads to users worldwide.

---

## 4. SHA-256 Checksum Verification

Users can verify binary authenticity:

### macOS / Linux:
```bash
shasum -a 256 VisionEye-macOS-AppleSilicon.dmg
```

### Windows (PowerShell):
```powershell
Get-FileHash .\VisionEye-Windows-x64.exe -Algorithm SHA256
```
