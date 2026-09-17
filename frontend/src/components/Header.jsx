import React, { useState, useEffect } from 'react';
import { Eye, Cpu, Radio, Activity, Download, Smartphone, Sliders, Maximize, ExternalLink, Zap } from 'lucide-react';
import { detectHardwareCapabilities } from '../services/hardware';

export default function Header({
  telemetry,
  wsStatus,
  onOpenSystemInfo,
  onOpenCalibrationGuide,
  onOpenDownloadModal,
  onToggleFullscreen
}) {
  const [hw, setHw] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    detectHardwareCapabilities().then(setHw);
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }
  }, []);

  const fps = telemetry?.fps || 0;
  const isApple = hw?.adapterName?.includes('Apple') || telemetry?.platform?.is_apple_silicon;

  return (
    <header className="header-bar">
      {/* Brand & Logo */}
      <div className="logo-section">
        <div className="logo-icon-box">
          <Eye size={22} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div>
          <h1 className="brand-title">VISIONEYE</h1>
          <div className="brand-subtitle">AI Foot-Traffic Analytics & Occupancy</div>
        </div>
      </div>

      {/* Badges and Actions */}
      <div className="header-badges">
        {/* Hardware Acceleration Badge */}
        <div className="badge badge-silicon" title={`Client GPU Acceleration: ${hw?.adapterName || 'Detecting...'}`}>
          <Zap size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>{isApple ? 'Apple Silicon M4' : (hw?.webgpu ? 'WebGPU Accelerated' : 'WebGL / Metal GPU')}</span>
        </div>

        {/* Live WebSocket Connection Status */}
        <div className={`badge ${wsStatus === 'connected' ? 'badge-live' : 'badge-danger'}`} title="Real-Time WebSocket Connection">
          <span className={`pulse-dot ${wsStatus === 'connected' ? '' : 'bg-red-500'}`} />
          <Radio size={12} />
          <span>{wsStatus === 'connected' ? 'LIVE' : 'CONNECTING'}</span>
        </div>

        {/* Live FPS */}
        <div className="badge" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#F59E0B' }} title="Real-Time AI Inference Speed">
          <Activity size={13} />
          <span>{fps} FPS</span>
        </div>

        {/* Download App Modal Trigger */}
        <button
          onClick={onOpenDownloadModal}
          className="btn btn-primary"
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          title="Download Desktop App for Mac, Windows, Linux or Install PWA"
        >
          <Download size={14} />
          <span>Download App</span>
        </button>

        {/* Calibration Guide */}
        <button
          onClick={onOpenCalibrationGuide}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}
          title="Adjust virtual counting line or 4-point perspective"
        >
          <Sliders size={13} />
          <span>Calibration</span>
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={onToggleFullscreen}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
          title="Toggle Fullscreen Mode"
        >
          <Maximize size={13} />
        </button>
      </div>
    </header>
  );
}
