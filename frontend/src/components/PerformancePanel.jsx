import React, { useState } from 'react';
import { Cpu, Activity, Clock, Layers, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { resetAnalytics } from '../services/api';

export default function PerformancePanel({ telemetry, onResetCounters }) {
  const [isOpen, setIsOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fps = telemetry?.fps || 0;
  const latency = telemetry?.detection_latency_ms || telemetry?.processing_latency_ms || 0;
  const resolution = telemetry?.resolution || telemetry?.source?.resolution || 'Auto';
  const model = telemetry?.model || 'YOLO26n ONNX (Nano)';

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetAnalytics();
      onResetCounters?.();
    } catch (e) {
      console.error('Reset error:', e);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xs)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.25rem',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isOpen ? '#f8fafc' : '#ffffff',
          transition: 'background-color 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Activity size={16} style={{ color: '#2563eb' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
            Performance & Diagnostics
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({fps} FPS, {latency} ms)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.8rem' }}>
          <span>{isOpen ? 'Hide' : 'Show Details'}</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>AI SPEED</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#2563eb' }}>{fps} FPS</div>
            </div>

            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>LATENCY</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>{latency} ms</div>
            </div>

            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>RESOLUTION</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{resolution}</div>
            </div>

            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.15rem' }}>MODEL ENGINE</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', minHeight: '36px' }}
            >
              <RotateCcw size={13} />
              <span>{resetting ? 'Resetting...' : 'Reset Counters to 0'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
