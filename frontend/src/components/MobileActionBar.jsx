import React from 'react';
import { Sliders, Play, Pause } from 'lucide-react';

export default function MobileActionBar({
  isPaused,
  onTogglePlay,
  onOpenLineEdit,
}) {
  return (
    <div className="mobile-action-bar">
      <button
        type="button"
        onClick={onOpenLineEdit}
        className="btn btn-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        <Sliders size={16} />
        <span>Edit Line</span>
      </button>

      <button
        type="button"
        onClick={onTogglePlay}
        className={`btn ${isPaused ? 'btn-primary' : 'btn-secondary'}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          fontSize: '0.85rem',
          fontWeight: 700,
          backgroundColor: isPaused ? '#2563eb' : '#eff6ff',
          color: isPaused ? '#ffffff' : '#2563eb',
          borderColor: isPaused ? '#2563eb' : '#bfdbfe',
        }}
      >
        {isPaused ? <Play size={16} /> : <Pause size={16} />}
        <span>{isPaused ? 'Start Analytics' : 'Pause'}</span>
      </button>
    </div>
  );
}
