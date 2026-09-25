import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Cpu, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
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
    const link = document.createElement('a');
    link.href = currentPlatform.directUrl;
    link.setAttribute('download', currentPlatform.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem 3rem',
        maxWidth: '720px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="clean-card"
        style={{
          padding: '2rem 1.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.5rem',
        }}
      >
        {/* Back link */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={onBackToApp}
            className="btn btn-ghost"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', minHeight: '34px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Video Analytics</span>
          </button>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Download VisionEye Desktop & Mobile
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
            Standalone offline AI inference powered by Apple Silicon CoreML & YOLO26n ONNX
          </p>
        </div>

        {/* Platform Selection Buttons (Responsive Flex / Grid) */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Choose Your Platform
          </span>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
              gap: '0.65rem',
              width: '100%',
            }}
          >
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
                    padding: '0.75rem 0.5rem',
                    gap: '0.3rem',
                    borderRadius: '12px',
                    position: 'relative',
                    minHeight: '64px',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                    color: isSelected ? '#1d4ed8' : '#334155',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{p.icon}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{p.name}</span>
                  {isDetected && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        border: '2px solid #ffffff',
                      }}
                      title="Your Device OS"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Platform Details & Direct Download */}
        <div
          style={{
            width: '100%',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              {currentPlatform.icon} {currentPlatform.name} ({currentPlatform.target})
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Package: {currentPlatform.filename} • {currentPlatform.size}
            </div>
          </div>

          <button
            onClick={handleTriggerDownload}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', maxWidth: '380px' }}
          >
            <Download size={18} />
            <span>Download for {currentPlatform.name}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
            <ShieldCheck size={14} />
            <span>Official SHA-256 Verified Binary • 100% Virus-Free</span>
          </div>
        </div>
      </div>
    </div>
  );
}
