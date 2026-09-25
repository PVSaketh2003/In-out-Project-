import React, { useState, useEffect } from 'react';
import { Eye, Video, Download, Activity, Menu, Maximize, User, HelpCircle, LogOut, Zap, Cpu, CheckCircle2, X } from 'lucide-react';
import MobileMenu from './MobileMenu';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hwInfo, setHwInfo] = useState(null);
  const [showHwModal, setShowHwModal] = useState(false);
  const fps = telemetry?.fps || 0;

  useEffect(() => {
    detectHardwareCapabilities().then(setHwInfo).catch(console.warn);
  }, []);

  return (
    <>
      <header className="header-bar">
        {/* Left: Brand Logo & Title */}
        <div className="logo-section" onClick={() => onChangeView?.('app')}>
          <div className="logo-icon-box">
            <Eye size={20} />
          </div>
          <div>
            <h1 className="brand-title">VisionEye</h1>
            <div className="brand-subtitle hide-on-mobile">Video Foot-Traffic Analytics</div>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs */}
        <nav className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '12px' }}>
          <button
            onClick={() => onChangeView?.('app')}
            className={`btn ${currentView === 'app' ? 'btn-active' : 'btn-ghost'}`}
            style={{
              padding: '0.4rem 0.95rem',
              fontSize: '0.82rem',
              borderRadius: '9px',
              minHeight: '36px',
              backgroundColor: currentView === 'app' ? '#ffffff' : 'transparent',
              color: currentView === 'app' ? '#2563eb' : '#475569',
              boxShadow: currentView === 'app' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontWeight: currentView === 'app' ? 700 : 500,
            }}
          >
            <Video size={14} />
            <span>Video Analytics</span>
          </button>

          <button
            onClick={() => onChangeView?.('download')}
            className={`btn ${currentView === 'download' ? 'btn-active' : 'btn-ghost'}`}
            style={{
              padding: '0.4rem 0.95rem',
              fontSize: '0.82rem',
              borderRadius: '9px',
              minHeight: '36px',
              backgroundColor: currentView === 'download' ? '#ffffff' : 'transparent',
              color: currentView === 'download' ? '#2563eb' : '#475569',
              boxShadow: currentView === 'download' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              fontWeight: currentView === 'download' ? 700 : 500,
            }}
          >
            <Download size={14} />
            <span>Download App</span>
          </button>
        </nav>

        {/* Right Desktop: Processing Speed, User & Fullscreen */}
        <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* WebGPU / Hardware Accelerator Badge */}
          <button
            type="button"
            onClick={() => setShowHwModal(true)}
            className={`badge ${hwInfo?.webgpu ? 'badge-blue' : 'badge-green'}`}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              cursor: 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            title="Click to view client GPU acceleration status"
          >
            <Zap size={13} style={{ color: hwInfo?.webgpu ? '#2563eb' : '#059669' }} />
            <span>{hwInfo?.webgpu ? 'WebGPU Active' : (hwInfo?.accelerationLabel || 'GPU Active')}</span>
          </button>

          {/* FPS Speed Pill */}
          <div className="badge badge-blue" title="Real-time AI Inference Speed" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
            <span className="pulse-dot" />
            <span>{fps} FPS</span>
          </div>

          {/* User Account / Logout */}
          {userEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.3rem 0.65rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#334155', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {userEmail}
              </span>
              <button
                onClick={onLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.1rem 0.3rem',
                }}
                title="Sign out"
              >
                Logout
              </button>
            </div>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.6rem', minHeight: '36px', borderRadius: '9px' }}
            title="Toggle Fullscreen"
          >
            <Maximize size={15} />
          </button>
        </div>

        {/* Right Mobile: WebGPU indicator & Hamburger Button */}
        <div className="hide-on-desktop" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowHwModal(true)}
            className={`badge ${hwInfo?.webgpu ? 'badge-blue' : 'badge-green'}`}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
          >
            <Zap size={11} />
            <span>{hwInfo?.webgpu ? 'WebGPU' : 'GPU'}</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f172a',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs)',
            }}
            aria-label="Open Navigation Menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* WebGPU & Hardware Diagnostic Modal */}
      {showHwModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowHwModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <Zap size={18} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Hardware Acceleration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHwModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: '#64748b' }}>Operating System:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{hwInfo?.os || 'Detecting...'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: '#64748b' }}>Acceleration Engine:</span>
                <span style={{ fontWeight: 600, color: hwInfo?.webgpu ? '#2563eb' : '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} />
                  {hwInfo?.accelerationLabel || 'Active'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: '#64748b' }}>GPU Device / Adapter:</span>
                <span style={{ fontWeight: 600, color: '#0f172a', textAlign: 'right', maxWidth: '200px', wordBreak: 'break-word' }}>
                  {hwInfo?.adapterName || 'Direct Hardware Adapter'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: '#64748b' }}>CPU Concurrency:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{hwInfo?.hardwareConcurrency || 4} Cores</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: '#64748b' }}>Inference Throughput:</span>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{fps} FPS (Real-time)</span>
              </div>
            </div>

            <p style={{ margin: '1rem 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
              VisionEye utilizes WebGPU with automatic WebGL2 and neural streaming fallback to ensure 60fps responsive video analytics across all devices.
            </p>

            <button
              type="button"
              onClick={() => setShowHwModal(false)}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem', minHeight: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Slide-out Mobile Drawer */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentView={currentView}
        onChangeView={onChangeView}
        userEmail={userEmail}
        onLogout={onLogout}
        onOpenSettings={onOpenCalibrationGuide}
        onOpenHelp={onOpenCalibrationGuide}
        fps={fps}
      />
    </>
  );
}
