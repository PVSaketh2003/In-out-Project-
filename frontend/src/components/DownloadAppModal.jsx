import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, Cpu, CheckCircle2, Zap, X, Shield, ExternalLink } from 'lucide-react';
import { detectHardwareCapabilities } from '../services/hardware';

export default function DownloadAppModal({ onClose }) {
  const [hw, setHw] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    detectHardwareCapabilities().then(setHw);

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setInstalled(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handlePWAInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert("📲 To install on iOS Safari:\n\n1. Tap the Share button (box with up arrow) at bottom of screen.\n2. Select 'Add to Home Screen'.\n3. Tap 'Add' to launch full-screen!");
      } else {
        alert("📲 To install:\n\nClick your browser's menu (⋮ or ⊕) in the URL bar and select 'Install VisionEye' or 'Add to Home screen'.");
      }
    }
  };

  const releasesUrl = "https://github.com/PVSaketh2003/In-out-Project-/releases";

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(3, 6, 15, 0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '680px', width: '100%', padding: '1.75rem',
        borderRadius: '16px', border: '1px solid rgba(0, 240, 255, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative'
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '1.25rem', right: '1.25rem',
          background: 'rgba(255,255,255,0.08)', border: 'none', color: '#FFF',
          borderRadius: '50%', width: '32px', height: '32px', display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}>
          <X size={18} />
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0,240,255,0.25), rgba(16,185,129,0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #00F0FF'
          }}>
            <Download size={22} style={{ color: '#00F0FF' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFF', letterSpacing: '0.02em' }}>
              Download VisionEye Application
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Native desktop binaries & progressive web app with WebGPU hardware acceleration
            </p>
          </div>
        </div>

        {/* Hardware / WebGPU Detection Badge */}
        <div style={{
          background: 'rgba(0, 240, 255, 0.06)', border: '1px solid rgba(0, 240, 255, 0.2)',
          borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={18} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Detected Client Hardware & GPU
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFF', fontFamily: 'var(--font-mono)' }}>
                {hw ? hw.adapterName : 'Scanning WebGPU / GPU adapter...'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {hw?.webgpu ? (
              <span className="badge badge-live" style={{ fontSize: '0.7rem' }}>
                <Zap size={12} /> WebGPU Active
              </span>
            ) : (
              <span className="badge badge-silicon" style={{ fontSize: '0.7rem' }}>
                <Zap size={12} /> WebGL / Metal
              </span>
            )}
          </div>
        </div>

        {/* Desktop Download Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {/* macOS */}
          <a
            href={releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-panel"
            style={{
              padding: '1rem', textDecoration: 'none', color: '#FFF',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🍎 macOS</span>
              <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Apple Silicon M1/M2/M3/M4 & Intel DMG
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600, marginTop: 'auto' }}>
              Download DMG →
            </span>
          </a>

          {/* Windows */}
          <a
            href={releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-panel"
            style={{
              padding: '1rem', textDecoration: 'none', color: '#FFF',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🪟 Windows</span>
              <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Windows 10 / 11 64-bit EXE Installer
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600, marginTop: 'auto' }}>
              Download EXE →
            </span>
          </a>

          {/* Linux */}
          <a
            href={releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-panel"
            style={{
              padding: '1rem', textDecoration: 'none', color: '#FFF',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🐧 Linux</span>
              <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ubuntu, Debian, Fedora (AppImage & DEB)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600, marginTop: 'auto' }}>
              Download AppImage →
            </span>
          </a>
        </div>

        {/* 1-Click PWA Web App Install */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,240,255,0.1), rgba(16,185,129,0.08))',
          border: '1px solid rgba(0,240,255,0.3)', borderRadius: '12px', padding: '1rem 1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Smartphone size={22} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#FFF', fontSize: '0.88rem' }}>
                Instant Web App (PWA)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Zero download installation • Adds icon to Mac Dock, iPhone, iPad, or Android
              </div>
            </div>
          </div>
          <button
            onClick={handlePWAInstall}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700 }}
          >
            {installed ? '✓ App Installed' : '⚡ 1-Click Install PWA'}
          </button>
        </div>
      </div>
    </div>
  );
}
