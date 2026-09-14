/**
 * VisionEye Download Website Engine
 * Dynamic OS / Architecture Detection • GitHub Releases API Integration • Tab Navigation
 * Domain: https://pvsairamsaketh.in
 */

const GITHUB_REPO = 'PVSaketh2003/In-out-Project-';
const FALLBACK_VERSION = 'v1.0.0';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

// State
let latestReleaseData = null;

/**
 * Detect client OS and Architecture
 */
function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  let os = 'unknown';
  let arch = 'x64';
  let label = 'Desktop';
  let icon = '💻';
  let fileName = '';
  let installType = 'installer';

  // Check for macOS
  if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macos';
    
    // Check for Apple Silicon (ARM64)
    // In modern browsers, check userAgentData or WebGL unmasked renderer
    let isArm64 = false;
    if (navigator.userAgentData && navigator.userAgentData.architecture) {
      isArm64 = navigator.userAgentData.architecture.includes('arm');
    }
    
    // WebGL Renderer heuristic for Apple M-series
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
          if (renderer.includes('apple') && (renderer.includes('m1') || renderer.includes('m2') || renderer.includes('m3') || renderer.includes('m4') || renderer.includes('apple gpu'))) {
            isArm64 = true;
          }
        }
      }
    } catch (e) {}

    if (isArm64 || (!platform.includes('intel') && !ua.includes('intel'))) {
      arch = 'arm64';
      label = 'macOS Apple Silicon (M1/M2/M3/M4)';
      icon = '🍏';
      fileName = 'VisionEye-macOS-AppleSilicon.dmg';
    } else {
      arch = 'x64';
      label = 'macOS Intel (x86_64)';
      icon = '🍎';
      fileName = 'VisionEye-macOS-Intel.dmg';
    }
  } 
  // Check for Windows
  else if (platform.includes('win') || ua.includes('windows')) {
    os = 'windows';
    arch = 'x64';
    label = 'Windows (64-bit)';
    icon = '🪟';
    fileName = 'VisionEye-Windows-x64.exe';
  } 
  // Check for Linux
  else if (platform.includes('linux') || ua.includes('linux') || ua.includes('x11')) {
    os = 'linux';
    arch = 'x64';
    label = 'Linux (x86_64 AppImage)';
    icon = '🐧';
    fileName = 'VisionEye-Linux-x64.AppImage';
  }

  return { os, arch, label, icon, fileName, installType };
}

/**
 * Fetch latest release from GitHub API
 */
async function fetchLatestRelease() {
  try {
    const res = await fetch(GITHUB_RELEASES_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    latestReleaseData = data;
    updateUIWithReleaseData(data);
  } catch (err) {
    console.warn('[Website] Using fallback release data:', err);
    updateUIWithFallback();
  }
}

/**
 * Update UI with live GitHub release data
 */
function updateUIWithReleaseData(data) {
  const versionTag = data.tag_name || FALLBACK_VERSION;
  const publishedDate = data.published_at ? new Date(data.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Latest';
  
  // Update version badges
  document.querySelectorAll('.js-latest-version').forEach(el => el.textContent = versionTag);
  document.querySelectorAll('.js-release-date').forEach(el => el.textContent = publishedDate);
  
  // Update download links with asset URLs if available
  const userPlatform = detectPlatform();
  updateDownloadButtons(versionTag, data.assets || [], userPlatform);
}

/**
 * Fallback release values if repo is not yet tagged or API rate limited
 */
function updateUIWithFallback() {
  const userPlatform = detectPlatform();
  document.querySelectorAll('.js-latest-version').forEach(el => el.textContent = FALLBACK_VERSION);
  document.querySelectorAll('.js-release-date').forEach(el => el.textContent = 'Active Production');
  updateDownloadButtons(FALLBACK_VERSION, [], userPlatform);
}

/**
 * Update download buttons with target URLs
 */
function updateDownloadButtons(version, assets, platform) {
  const ctaBtn = document.getElementById('primaryDownloadBtn');
  const ctaPlatformTitle = document.getElementById('detectedPlatformTitle');
  const ctaFileName = document.getElementById('detectedFileName');
  
  if (ctaPlatformTitle) {
    ctaPlatformTitle.innerHTML = `${platform.icon} ${platform.label}`;
  }

  // Find matching asset
  let directUrl = `${GITHUB_RELEASES_URL}/download/${version}/${platform.fileName}`;
  let assetSize = '~115 MB';

  const matchedAsset = assets.find(a => a.name.toLowerCase() === platform.fileName.toLowerCase());
  if (matchedAsset) {
    directUrl = matchedAsset.browser_download_url;
    assetSize = `${(matchedAsset.size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (ctaBtn) {
    ctaBtn.href = directUrl;
    ctaBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      <span>Download VisionEye for ${platform.os === 'macos' ? 'macOS' : platform.os === 'windows' ? 'Windows' : 'Linux'}</span>
    `;
  }

  if (ctaFileName) {
    ctaFileName.textContent = `${platform.fileName} (${assetSize})`;
  }

  // Update specific platform buttons
  updateSpecificButton('btnMacArm', version, assets, 'VisionEye-macOS-AppleSilicon.dmg');
  updateSpecificButton('btnMacIntel', version, assets, 'VisionEye-macOS-Intel.dmg');
  updateSpecificButton('btnWin', version, assets, 'VisionEye-Windows-x64.exe');
  updateSpecificButton('btnLinux', version, assets, 'VisionEye-Linux-x64.AppImage');
}

function updateSpecificButton(elemId, version, assets, targetFileName) {
  const btn = document.getElementById(elemId);
  if (!btn) return;
  
  let url = `${GITHUB_RELEASES_URL}/download/${version}/${targetFileName}`;
  const asset = assets.find(a => a.name.toLowerCase() === targetFileName.toLowerCase());
  if (asset) {
    url = asset.browser_download_url;
  }
  btn.href = url;
}

/**
 * Setup Tabs
 */
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Auto-switch installation tab to detected OS
  const platform = detectPlatform();
  const targetTab = document.querySelector(`.tab-btn[data-tab="tab-${platform.os}"]`);
  if (targetTab) {
    targetTab.click();
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  fetchLatestRelease();
});
