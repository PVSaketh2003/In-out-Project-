import React, { useState, useEffect } from 'react';
import { Eye, Cpu, Radio, Activity, Info, Sliders, Maximize, Download, Smartphone } from 'lucide-react';

export default function Header({ telemetry, wsStatus, onOpenSystemInfo, onOpenCalibrationGuide, onToggleFullscreen }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // iOS / manual guide alert
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert("📲 To install VisionEye on iOS:\n\n1. Tap the Share button (⎋ with arrow) at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.\n3. Tap 'Add' to launch full-screen!");
      } else {
        alert("📲 To install VisionEye:\n\nTap your browser's menu (⋮) and select 'Add to Home screen' or 'Install app'.");
      }
    }
  };

  const isAppleSilicon = telemetry?.providers?.some(p => p.includes('CoreML')) || true;
  const fps = telemetry?.fps || 0;
  const resolution = telemetry?.resolution || '640x480';

  return (
    <header className="header-bar">
      <div className="logo-section">
        <div className="logo-icon-box">
          <Eye size={22} className="animate-pulse" />
        </div>
        <div>
          <h1 className="brand-title">VISIONEYE</h1>
          <div className="brand-subtitle">Foot-Traffic Analytics &bull; Real-Time CV</div>
        </div>
      </div>

      <div className="header-badges">
        {/* Apple Silicon M4 / CoreML Badge */}
        <div className="badge badge-silicon" title="Hardware Acceleration: Apple Silicon M4">
          <Cpu size={14} />
          <span>M4 Apple Silicon {telemetry?.providers?.includes('CoreMLExecutionProvider') ? '(CoreML)' : '(CPU)'}</span>
        </div>

        {/* Model info */}
        <div className="badge" title="Underlying Model: YOLO26n ONNX">
          <span>{telemetry?.model || 'YOLO26n ONNX'}</span>
        </div>

        {/* Resolution */}
        <div className="badge" title="Input Resolution">
          <span>{resolution}</span>
        </div>

        {/* WebSocket Connection Status */}
        <div className={`badge ${wsStatus === 'connected' ? 'badge-live' : 'badge-danger'}`} title="WebSocket Status">
          <span className={`pulse-dot ${wsStatus === 'connected' ? '' : 'bg-red-500'}`} />
          <Radio size={13} />
          <span>{wsStatus === 'connected' ? 'LIVE WS' : 'RECONNECTING'}</span>
        </div>

        {/* Real-Time Processing FPS */}
        <div className="badge" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#F59E0B' }} title="Actual Processing FPS">
          <Activity size={14} />
          <span>{fps} FPS</span>
        </div>

        {/* Install PWA Button (Visible if not in standalone mode) */}
        {!isInstalled && (
          <button
            onClick={handleInstallClick}
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(16, 185, 129, 0.25))', border: '1px solid #00F0FF' }}
            title="Install VisionEye App to Home Screen"
          >
            <Smartphone size={14} />
            <span>Install App</span>
          </button>
        )}

        {/* Actions */}
        <button
          onClick={onOpenCalibrationGuide}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
          title="Calibration Guide"
        >
          <Sliders size={14} />
          <span>Calibration</span>
        </button>

        <button
          onClick={onOpenSystemInfo}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
          title="System Diagnostics & Specs"
        >
          <Info size={14} />
          <span>System</span>
        </button>

        <button
          onClick={onToggleFullscreen}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
          title="Toggle Fullscreen"
        >
          <Maximize size={14} />
        </button>
      </div>
    </header>
  );
}
