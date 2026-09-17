import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Cpu, ShieldCheck, ArrowRight, Smartphone, Monitor } from 'lucide-react';
import { PLATFORMS, detectUserPlatform } from '../services/platforms';

export default function DownloadView({ onBackToApp }) {
  const [selectedId, setSelectedId] = useState('macos');
  const [detectedId, setDetectedId] = useState('macos');

  useEffect(() => {
    const detected = detectUserPlatform();
    setDetectedId(detected);
    setSelectedId(detected);
  }, []);

  const currentPlatform = PLATFORMS[selectedId] || PLATFORMS.macos;

  const handleTriggerDownload = () => {
    // Directly trigger browser download of real platform artifact
    const link = document.createElement('a');
    link.href = currentPlatform.directUrl;
    link.setAttribute('download', currentPlatform.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '640px',
        width: '100%',
        padding: '2.5rem 2rem',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '1.75rem',
      }}>
        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <h1 style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#FFF',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.03em',
          }}>
            Download Application
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-time computer vision analytics with local hardware acceleration
          </p>
        </div>

        {/* Platform Selection Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            CHOOSE YOUR DEVICE
          </span>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '0.5rem',
          }}>
            {Object.values(PLATFORMS).map((p) => {
              const isSelected = p.id === selectedId;
              const isDetected = p.id === detectedId;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`btn ${isSelected ? 'btn-active' : 'btn-secondary'}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem 0.35rem',
                    gap: '0.35rem',
                    borderRadius: '12px',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>{p.icon}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{p.name}</span>
                  {isDetected && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--accent-emerald)',
                      border: '2px solid #070a11',
                    }} title="Auto-Detected OS" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Platform Details & Direct Download Button */}
        <div style={{
          width: '100%',
          background: 'rgba(13, 19, 33, 0.7)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFF' }}>
              {currentPlatform.icon} {currentPlatform.name} ({currentPlatform.target})
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {currentPlatform.filename} • {currentPlatform.size} • v1.0.0
            </div>
          </div>

          {/* Big Download Button */}
          <button
            onClick={handleTriggerDownload}
            className="btn btn-primary"
            style={{
              width: '100%',
              maxWidth: '320px',
              padding: '0.95rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem',
              boxShadow: '0 0 25px rgba(0, 240, 255, 0.3)',
            }}
          >
            <Download size={20} />
            <span>Download for {currentPlatform.name}</span>
          </button>

          {/* Installation Instructions */}
          <div style={{
            fontSize: '0.78rem',
            color: 'var(--text-dim)',
            lineHeight: 1.5,
            maxWidth: '460px',
          }}>
            {currentPlatform.guide}
          </div>
        </div>

        {/* Back to Live App */}
        {onBackToApp && (
          <button
            onClick={onBackToApp}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-cyan)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            ← Return to Live Video Analytics
          </button>
        )}
      </div>
    </div>
  );
}
