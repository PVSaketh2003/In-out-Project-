import React from 'react';
import { Cpu, ShieldCheck, HardDrive, Eye, Zap, X, CheckCircle2 } from 'lucide-react';

export default function SystemInfoModal({ telemetry, onClose }) {
  const providers = telemetry?.providers || ['CPUExecutionProvider'];
  const hasCoreML = providers.some((p) => p.includes('CoreML'));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
          <div className="section-title">
            <Cpu size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span>SYSTEM SPECIFICATIONS & DIAGNOSTICS</span>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.82rem' }}>
          {/* Hardware & Silicon Target */}
          <div style={{ background: 'rgba(0, 240, 255, 0.05)', border: '1px solid var(--border-cyan)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
              <Cpu size={16} />
              <span>Apple Silicon M4 Architecture</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>
              Optimized for arm64 Apple Silicon. Runs ONNX Runtime with CoreML execution provider where supported, and fallback CPU threading. Zero NVIDIA CUDA / TensorRT dependencies.
            </p>
          </div>

          {/* Key Specs Table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>UNDERLYING MODEL</div>
              <div style={{ color: '#FFFFFF', fontWeight: 600, marginTop: '0.2rem' }}>YOLO26n ONNX (Person Class)</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>ACTIVE INFERENCE PROVIDERS</div>
              <div style={{ color: hasCoreML ? 'var(--accent-emerald)' : '#FFFFFF', fontWeight: 600, marginTop: '0.2rem' }}>
                {providers.join(', ')}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>FRAMEWORK / BACKEND</div>
              <div style={{ color: '#FFFFFF', fontWeight: 600, marginTop: '0.2rem' }}>Django 6.1 + Channels (Daphne)</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>FRONTEND RUNTIME</div>
              <div style={{ color: '#FFFFFF', fontWeight: 600, marginTop: '0.2rem' }}>React 18 + Vite (Vanilla CSS)</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>INPUT RESOLUTION</div>
              <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, marginTop: '0.2rem' }}>
                {telemetry?.resolution || '640x480'}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>PROCESSING QUEUE STRATEGY</div>
              <div style={{ color: 'var(--accent-emerald)', fontWeight: 600, marginTop: '0.2rem' }}>Latest-Frame Priority (Drop-on-lag)</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button onClick={onClose} className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
              Close Diagnostics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
