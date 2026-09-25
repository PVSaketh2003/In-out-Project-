import React from 'react';
import { Film, Upload, Camera, Radio, Check, Loader2 } from 'lucide-react';

export default function VideoSourceSelector({
  selectedSource,
  onSelectSource,
  onOpenUpload,
  onOpenRTSP,
  uploading = false,
  uploadProgress = 0,
  uploadStatusText = '',
}) {
  const sources = [
    {
      id: 'synthetic',
      name: 'Demo Video',
      icon: Film,
    },
    {
      id: 'client',
      name: 'Device Camera',
      icon: Camera,
    },
    {
      id: 'file',
      name: 'Upload File',
      icon: Upload,
      isUpload: true,
    },
    {
      id: 'rtsp',
      name: 'RTSP Stream',
      icon: Radio,
      isRTSP: true,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.35rem',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-xs)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {sources.map((src) => {
        const Icon = src.icon;
        const isSelected = selectedSource === src.id;

        // Special Rendering for the Upload File button during active upload
        if (src.isUpload && uploading) {
          const isComplete = uploadProgress >= 100;
          return (
            <div
              key={src.id}
              style={{
                flex: '1.4 1 180px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0.45rem 0.85rem',
                borderRadius: '9px',
                backgroundColor: isComplete ? '#059669' : '#1e40af',
                color: '#ffffff',
                minHeight: '38px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Animated Progress Track (Slider fill style) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${Math.max(4, Math.min(100, uploadProgress))}%`,
                  background: isComplete
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                  opacity: 0.9,
                  transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 1,
                }}
              />

              {/* Progress Slider Track Line at the bottom */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  zIndex: 3,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(4, Math.min(100, uploadProgress))}%`,
                    backgroundColor: '#ffffff',
                    transition: 'width 0.25s ease',
                    boxShadow: '0 0 6px #ffffff',
                  }}
                />
              </div>

              {/* Foreground Label & Percentage */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {isComplete ? (
                    <Check size={14} className="animate-bounce" style={{ color: '#ffffff' }} />
                  ) : (
                    <Loader2 size={14} className="animate-spin" style={{ color: '#ffffff' }} />
                  )}
                  <span>{isComplete ? 'Playing Video...' : 'Uploading...'}</span>
                </div>

                {/* Percentage Badge */}
                <span
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                  }}
                >
                  {Math.round(uploadProgress)}%
                </span>
              </div>
            </div>
          );
        }

        return (
          <button
            key={src.id}
            type="button"
            onClick={() => {
              if (src.isUpload) {
                onOpenUpload?.();
              } else if (src.isRTSP) {
                onOpenRTSP?.();
              } else {
                onSelectSource(src.id);
              }
            }}
            style={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: isSelected ? '#2563eb' : 'transparent',
              color: isSelected ? '#ffffff' : '#475569',
              fontWeight: isSelected ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              minHeight: '38px',
            }}
          >
            <Icon size={15} style={{ color: isSelected ? '#ffffff' : '#64748b' }} />
            <span>{src.name}</span>
          </button>
        );
      })}
    </div>
  );
}
