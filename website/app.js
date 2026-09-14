/**
 * VisionEye Universal Web & Download Engine
 * Dynamic OS / Device Detection (macOS, Windows, Linux, Android, iOS)
 * GitHub Releases API Integration • Tab Navigation • Robust Fallback
 * Domain: https://pvsairamsaketh.in
 */

const GITHUB_REPO = 'PVSaketh2003/In-out-Project-';
const FALLBACK_VERSION = 'v1.0.0';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

// State
let latestReleaseData = null;

/**
 * Detect client OS, Device and Architecture
 */
function detectPlatform() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  
  let os = 'unknown';
  let arch = 'x64';
  let label = 'Desktop';
  let icon = '💻';
  let fileName = '';
  let isMobile = false;
  let directUrl = '';
  let subtext = '';

  // 1. Check for Android
  if (ua.includes('android')) {
    os = 'android';
    isMobile = true;
    label = 'Android Device (Smartphone / Tablet)';
    icon = '🤖';
    fileName = 'VisionEye Mobile Web App';
    directUrl = '/live';
    subtext = 'Zero Install • Runs instantly in Chrome / Firefox';
  }
  // 2. Check for iOS (iPhone / iPad / iPod)
  else if (
    ua.includes('iphone') || 
    ua.includes('ipad') || 
    ua.includes('ipod') || 
    (platform === 'macintel' && navigator.maxTouchPoints > 1)
  ) {
    os = 'ios';
    isMobile = true;
    label = 'iPhone / iPad (iOS & iPadOS)';
    icon = '📱';
    fileName = 'VisionEye iOS Web App';
    directUrl = '/live';
    subtext = 'Zero Install • Runs instantly in Safari / Chrome';
  }
  // 3. Check for macOS
  else if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macos';
    isMobile = false;
    
    // Check for Apple Silicon (ARM64)
    let isArm64 = false;
    if (navigator.userAgentData && navigator.userAgentData.architecture) {
      isArm64 = navigator.userAgentData.architecture.includes('arm');
    }
    
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
      subtext = 'v1.0.0 • Apple Silicon (.dmg)';
    } else {
      arch = 'x64';
      label = 'macOS Intel (x86_64)';
      icon = '🍎';
      fileName = 'VisionEye-macOS-Intel.dmg';
      subtext = 'v1.0.0 • Intel x64 (.dmg)';
    }
    directUrl = `${GITHUB_RELEASES_URL}/download/${FALLBACK_VERSION}/${fileName}`;
  } 
  // 4. Check for Windows
  else if (platform.includes('win') || ua.includes('windows')) {
    os = 'windows';
    arch = 'x64';
    isMobile = false;
    label = 'Windows (64-bit)';
    icon = '🪟';
    fileName = 'VisionEye-Windows-x64.exe';
    subtext = 'v1.0.0 • Windows Installer (.exe)';
    directUrl = `${GITHUB_RELEASES_URL}/download/${FALLBACK_VERSION}/${fileName}`;
  } 
  // 5. Check for Linux
  else if (platform.includes('linux') || ua.includes('linux') || ua.includes('x11')) {
    os = 'linux';
    arch = 'x64';
    isMobile = false;
    label = 'Linux (x86_64)';
    icon = '🐧';
    fileName = 'VisionEye-Linux-x64.AppImage';
    subtext = 'v1.0.0 • Portable AppImage';
    directUrl = `${GITHUB_RELEASES_URL}/download/${FALLBACK_VERSION}/${fileName}`;
  } 
  // 6. Generic Browser Fallback
  else {
    os = 'web';
    isMobile = false;
    label = 'Universal Web App';
    icon = '🌐';
    fileName = 'VisionEye Live Web Application';
    subtext = 'Universal Browser Access';
    directUrl = '/live';
  }

  return { os, arch, label, icon, fileName, isMobile, directUrl, subtext };
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
    console.warn('[Website] Using fallback release configuration:', err);
    updateUIWithFallback();
  }
}

/**
 * Update UI with live GitHub release data
 */
function updateUIWithReleaseData(data) {
  const versionTag = data.tag_name || FALLBACK_VERSION;
  const publishedDate = data.published_at 
    ? new Date(data.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
    : 'Active Production';
  
  // Update version badges
  document.querySelectorAll('.js-latest-version').forEach(el => el.textContent = versionTag);
  document.querySelectorAll('.js-release-date').forEach(el => el.textContent = publishedDate);
  
  const userPlatform = detectPlatform();
  updateDownloadButtons(versionTag, data.assets || [], userPlatform);
}

/**
 * Fallback release values
 */
function updateUIWithFallback() {
  const userPlatform = detectPlatform();
  document.querySelectorAll('.js-latest-version').forEach(el => el.textContent = FALLBACK_VERSION);
  document.querySelectorAll('.js-release-date').forEach(el => el.textContent = 'Active Production');
  updateDownloadButtons(FALLBACK_VERSION, [], userPlatform);
}

/**
 * Update primary and platform buttons
 */
function updateDownloadButtons(version, assets, platform) {
  const ctaBtn = document.getElementById('primaryDownloadBtn');
  const ctaLabel = document.getElementById('primaryDownloadLabel');
  const ctaSub = document.getElementById('primaryDownloadSub');
  const ctaIcon = document.getElementById('primaryOsIcon');
  const ctaFileName = document.getElementById('detectedFileName');
  
  if (ctaIcon) ctaIcon.textContent = platform.icon;
  
  if (platform.isMobile) {
    if (ctaLabel) ctaLabel.textContent = `⚡ Launch Live App on ${platform.os === 'android' ? 'Android' : 'iOS'}`;
    if (ctaSub) ctaSub.textContent = platform.subtext;
    if (ctaBtn) {
      ctaBtn.href = '/live';
      ctaBtn.className = 'btn-download-primary btn-mobile-launch';
    }
    if (ctaFileName) {
      ctaFileName.textContent = `Zero Install Required • Runs inside any mobile browser`;
    }
  } else {
    // Desktop Flow
    let directUrl = `${GITHUB_RELEASES_URL}/download/${version}/${platform.fileName}`;
    let assetSize = '~115 MB';

    const matchedAsset = assets.find(a => a.name.toLowerCase() === platform.fileName.toLowerCase());
    if (matchedAsset) {
      directUrl = matchedAsset.browser_download_url;
      assetSize = `${(matchedAsset.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    if (ctaLabel) {
      ctaLabel.textContent = `Download for ${platform.os === 'macos' ? 'macOS' : platform.os === 'windows' ? 'Windows' : 'Linux'}`;
    }
    if (ctaSub) {
      ctaSub.textContent = platform.subtext;
    }
    if (ctaBtn) {
      ctaBtn.href = directUrl;
    }
    if (ctaFileName) {
      ctaFileName.textContent = `${platform.fileName} (${assetSize})`;
    }
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
  let tabId = 'tab-macos';
  if (platform.isMobile) {
    tabId = 'tab-web';
  } else if (platform.os === 'windows') {
    tabId = 'tab-windows';
  } else if (platform.os === 'linux') {
    tabId = 'tab-linux';
  } else if (platform.os === 'macos') {
    tabId = 'tab-macos';
  }

  const targetTab = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (targetTab) {
    targetTab.click();
  }
}

// PWA Install Prompt State
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const ctaBtn = document.getElementById('primaryDownloadBtn');
  const userPlatform = detectPlatform();
  if (userPlatform.isMobile && ctaBtn) {
    ctaBtn.textContent = '📲 Install VisionEye App';
    ctaBtn.onclick = (evt) => {
      if (deferredInstallPrompt) {
        evt.preventDefault();
        deferredInstallPrompt.prompt();
        deferredInstallPrompt = null;
      }
    };
  }
});

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  fetchLatestRelease();
});

