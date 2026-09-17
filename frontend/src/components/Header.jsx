import React, { useState, useEffect } from 'react';
import { Eye, Cpu, Radio, Activity, Download, Smartphone, Sliders, Maximize, ExternalLink, Zap } from 'lucide-react';
import { detectHardwareCapabilities } from '../services/hardware';

export default function Header({
  telemetry,
  wsStatus,
  currentView,
  onChangeView,
  userEmail,
  onLogout,
  onOpenCalibrationGuide,
  onToggleFullscreen
}) {
  const [hw, setHw] = useState(null);

  useEffect(() => {
    detectHardwareCapabilities().then(setHw);
  }, []);

  const fps = telemetry?.fps || 0;
  const isApple = hw?.adapterName?.includes('Apple') || telemetry?.platform?.is_apple_silicon;

  return (
    <header className="header-bar">
      {/* Brand & Logo */}
      <div className="logo-section" style={{ cursor: 'pointer' }} onClick={() => onChangeView?.('app')}>
        <div className="logo-icon-box">
          <Eye size={20} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div>
          <h1 className="brand-title" style={{ fontSize: '1.1rem' }}>VISIONEYE</h1>
        </div>
      </div>

      {/* Navigation Tabs: Video Analytics vs Download Application */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '0.25rem',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        gap: '0.25rem',
      }}>
        <button
          onClick={() => onChangeView?.('app')}
          className={`btn ${currentView === 'app' ? 'btn-active' : 'btn-secondary'}`}
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', borderRadius: '8px' }}
        >
          <span>Video Analytics</span>
        </button>

        <button
          onClick={() => onChangeView?.('download')}
          className={`btn ${currentView === 'download' ? 'btn-active' : 'btn-secondary'}`}
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', borderRadius: '8px' }}
        >
          <Download size={13} />
          <span>Download App</span>
        </button>
      </div>

      {/* Status, User & Actions */}
      <div className="header-badges">
        {/* Live FPS */}
        <div className="badge" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#F59E0B' }} title="AI Inference Speed">
          <Activity size={13} />
          <span>{fps} FPS</span>
        </div>

        {/* User Email & Logout */}
        {userEmail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {userEmail}
            </span>
            <button
              onClick={onLogout}
              className="btn btn-secondary"
              style={{ padding: '0.32rem 0.65rem', fontSize: '0.72rem', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.3)' }}
              title="Sign Out"
            >
              Logout
            </button>
          </div>
        )}

        {/* Fullscreen toggle */}
        <button
          onClick={onToggleFullscreen}
          className="btn btn-secondary"
          style={{ padding: '0.32rem 0.5rem', fontSize: '0.75rem' }}
          title="Toggle Fullscreen"
        >
          <Maximize size={13} />
        </button>
      </div>
    </header>
  );
}
