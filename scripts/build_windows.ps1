# ==============================================================================
# Build Windows NSIS Installer for VisionEye (x64)
# ==============================================================================
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$DesktopDir = Join-Path $RootDir "desktop"
$FrontendDir = Join-Path $RootDir "frontend"

Write-Host "=============================================================================="
Write-Host " Building VisionEye Windows Installer (x64)"
Write-Host "=============================================================================="

# 1. Build frontend
Set-Location $FrontendDir
npm install
npm run build

# Copy frontend distribution
$DistTarget = Join-Path $DesktopDir "dist-frontend"
if (-Not (Test-Path $DistTarget)) {
    New-Item -ItemType Directory -Path $DistTarget | Out-Null
}
Copy-Item -Path (Join-Path $FrontendDir "dist\*") -Destination $DistTarget -Recurse -Force

# 2. Package desktop installer
Set-Location $DesktopDir
npm install
npm run dist:win

Write-Host "=============================================================================="
Write-Host " [OK] Windows Installer built successfully in: $DesktopDir\release"
Write-Host "=============================================================================="
