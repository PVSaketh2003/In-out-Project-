/**
 * VisionEye Universal Web & Download Engine
 * Dynamic OS / Device Detection (macOS, Windows, Linux, Android, iOS)
 * Seamless Fallback Modal • Tab Navigation • PWA Support
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
  let directUrl = '/live';
  let subtext = '';

  // 1. Check for Android
  if (ua.includes('android')) {
    os = 'android';
    isMobile = true;
    label = 'Android Smartphone / Tablet';
    icon = '🤖';
    fileName = 'VisionEye Mobile Web App';
    directUrl = '/live';
    subtext = 'Zero Install • Instant Access in Chrome / Firefox';
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
    subtext = 'Zero Install • Instant Access in Safari';
  }
  // 3. Check for macOS
  else if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macos';
    isMobile = false;
    
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
    directUrl = '/live';
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
    directUrl = '/live';
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
    directUrl = '/live';
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
 * Show Platform Information / Web App Launcher Modal
 */
function showPlatformModal(title, message, icon = '📱') {
  const modal = document.getElementById('platformModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalIcon = document.getElementById('modalIcon');
  
  if (!modal) return;

  if (modalTitle) modalTitle.textContent = title;
  if (modalBody) modalBody.textContent = message;
  if (modalIcon) modalIcon.textContent = icon;

  modal.style.display = 'flex';
}

function hidePlatformModal() {
  const modal = document.getElementById('platformModal');
  if (modal) modal.style.display = 'none';
}

/**
 * Setup Modal Event Listeners
 */
function setupModalListeners() {
  const modal = document.getElementById('platformModal');
  const closeBtn = document.getElementById('closeModalBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', hidePlatformModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hidePlatformModal();
    });
  }

  // Intercept desktop download buttons for mobile users
  const platform = detectPlatform();
  const desktopButtons = ['btnMacArm', 'btnMacIntel', 'btnWin', 'btnLinux'];

  desktopButtons.forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', (e) => {
        if (platform.isMobile) {
          e.preventDefault();
          showPlatformModal(
            'Mobile Device Detected',
            `You are currently visiting on an ${platform.os === 'ios' ? 'iPhone / iPad (iOS)' : 'Android'} device. Desktop installer packages cannot run on mobile phones. You can run VisionEye right now directly in your mobile browser with full camera and AI support!`,
            platform.os === 'ios' ? '📱' : '🤖'
          );
        } else {
          // If no GitHub release binary is downloaded yet, guide desktop user to live web app
          if (!latestReleaseData || !latestReleaseData.assets || latestReleaseData.assets.length === 0) {
            e.preventDefault();
            showPlatformModal(
              'Launch Live Web Application',
              'VisionEye is available to run right now in your browser with zero installation needed. Click Launch Live Web App below to start immediately!',
              '⚡'
            );
          }
        }
      });
    }
  });
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
    : 'Live Deployment';
  
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
  document.querySelectorAll('.js-release-date').forEach(el => el.textContent = 'Live Deployment');
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
  
  if (ctaIcon) ctaIcon.textContent = platform.isMobile ? '⚡' : '🚀';
  
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
    // Desktop Flow: Provide direct access to web app or downloads
    if (ctaLabel) {
      ctaLabel.textContent = `⚡ Launch Live Web App`;
    }
    if (ctaSub) {
      ctaSub.textContent = `Instant Access on ${platform.label} • Zero Setup`;
    }
    if (ctaBtn) {
      ctaBtn.href = '/live';
    }
    if (ctaFileName) {
      ctaFileName.textContent = `Desktop & Mobile AI Foot-Traffic Analytics`;
    }
  }
}

/**
 * Setup Installation Tabs
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
  let tabId = 'tab-web';
  if (!platform.isMobile) {
    if (platform.os === 'windows') {
      tabId = 'tab-windows';
    } else if (platform.os === 'linux') {
      tabId = 'tab-linux';
    } else if (platform.os === 'macos') {
      tabId = 'tab-macos';
    }
  }

  const targetTab = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (targetTab) {
    targetTab.click();
  }
}

// PWA Install Prompt Handler
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupModalListeners();
  fetchLatestRelease();
});
