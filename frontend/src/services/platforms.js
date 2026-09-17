/**
 * Centralized Platform Detection & Download Configurations
 * Supports macOS, Windows, Linux, Android, and iOS
 */

export function detectUserPlatform() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
    return 'macos';
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return 'windows';
  }
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
    return 'linux';
  }
  return 'macos'; // default modern fallback
}

export const PLATFORMS = {
  macos: {
    id: 'macos',
    name: 'macOS',
    icon: '🍎',
    filename: 'VisionEye-macOS-arm64.dmg',
    extension: '.dmg',
    size: '122 MB',
    directUrl: '/api/downloads/macos',
    zipUrl: '/api/downloads/macos-zip',
    target: 'Apple Silicon M1–M4 & Intel',
    guide: 'Open the downloaded .dmg and drag VisionEye to your Applications folder.',
  },
  windows: {
    id: 'windows',
    name: 'Windows',
    icon: '🪟',
    filename: 'VisionEye-Windows-x64.exe',
    extension: '.exe',
    size: '115 MB',
    directUrl: '/api/downloads/windows',
    target: 'Windows 10 / 11 64-bit',
    guide: 'Double-click the setup file and follow the quick installation prompt.',
  },
  linux: {
    id: 'linux',
    name: 'Linux',
    icon: '🐧',
    filename: 'VisionEye-Linux-x64.AppImage',
    extension: '.AppImage',
    size: '110 MB',
    directUrl: '/api/downloads/linux',
    target: 'Ubuntu, Debian, Fedora, Arch',
    guide: 'Make executable (chmod +x VisionEye-Linux-x64.AppImage) and run.',
  },
  android: {
    id: 'android',
    name: 'Android',
    icon: '🤖',
    filename: 'VisionEye-Android.apk',
    extension: '.apk',
    size: '28 MB',
    directUrl: '/api/downloads/android',
    target: 'Android 10+ (Phones & Tablets)',
    guide: 'Tap the downloaded APK to install VisionEye on your device.',
  },
  ios: {
    id: 'ios',
    name: 'iOS',
    icon: '📱',
    filename: 'VisionEye.mobileconfig',
    extension: '.mobileconfig',
    size: '15 KB',
    directUrl: '/api/downloads/ios',
    target: 'iPhone & iPad (iOS 15+)',
    guide: 'Download configuration profile, open iOS Settings → Profile Downloaded → Install.',
  },
};
