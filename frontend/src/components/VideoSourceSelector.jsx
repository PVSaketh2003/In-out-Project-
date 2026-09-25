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
      name: uploading
        ? (uploadStatusText || `Uploading ${uploadProgress}%`)
        : 'Upload File',
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
            {src.isUpload && uploading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Icon size={15} style={{ color: isSelected ? '#ffffff' : '#64748b' }} />
            )}
            <span>{src.name}</span>
          </button>
        );
      })}
    </div>
  );
}

