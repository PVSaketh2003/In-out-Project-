import React from 'react';
import { Sliders, Layers, X, Check, ArrowRight } from 'lucide-react';

export default function CalibrationModal({ onClose, onStartLineCalibration, onStartPerspectiveCalibration }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
          <div className="section-title">
            <Sliders size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span>CALIBRATION ASSISTANT</span>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.82rem' }}>
          {/* Step 1: Virtual Counting Line */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                <Sliders size={16} />
                <span>1. Virtual Counting Line (IN / OUT)</span>
              </div>
              <button
                onClick={() => {
                  onStartLineCalibration();
                  onClose();
                }}
                className="btn btn-primary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
              >
                Configure Line <ArrowRight size={13} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>
              Click and drag the cyan start and end handle points directly over the entrance doorway or passage. When a tracked person crosses the line downwards, <strong>IN</strong> increments; crossing upwards increments <strong>OUT</strong>.
            </p>
          </div>

          {/* Step 2: 4-Point Homography Perspective */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                <Layers size={16} />
                <span>2. 4-Corner Ground Perspective Homography</span>
              </div>
              <button
                onClick={() => {
                  onStartPerspectiveCalibration();
                  onClose();
                }}
                className="btn btn-primary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
              >
                Calibrate 4 Corners <ArrowRight size={13} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>
              Calibration is <strong>instantaneous in 0 ms</strong>. Drag the 4 corner handles (① TL, ② TR, ③ BR, ④ BL) on the live video stream to match the boundary of the floor, or click <strong>⚡ Auto-Calibrate Floor</strong> in the Controls Panel for 1-click setup. When done, click <strong>✓ Finish Calibration</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.45rem 1.1rem' }}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
