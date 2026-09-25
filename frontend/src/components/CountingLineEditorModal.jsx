import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, ArrowUpDown, Sliders, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { updateCountingLine, flipCountingLine } from '../services/api';

export default function CountingLineEditorModal({
  isOpen,
  onClose,
  initialStart = [0.15, 0.72],
  initialEnd = [0.85, 0.48],
  onSaved,
}) {
  const [lineStart, setLineStart] = useState(initialStart || [0.15, 0.72]);
  const [lineEnd, setLineEnd] = useState(initialEnd || [0.85, 0.48]);
  const [saving, setSaving] = useState(false);
  const [activePin, setActivePin] = useState(null); // 'A' | 'B' | null

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const activePinRef = useRef(null);
  const lineStartRef = useRef(initialStart || [0.15, 0.72]);
  const lineEndRef = useRef(initialEnd || [0.85, 0.48]);

  // Sync initial coordinates when modal opens
  useEffect(() => {
    if (isOpen) {
      const s = initialStart || [0.15, 0.72];
      const e = initialEnd || [0.85, 0.48];
      setLineStart(s);
      setLineEnd(e);
      lineStartRef.current = s;
      lineEndRef.current = e;
    }
  }, [isOpen, initialStart, initialEnd]);

  // Helper to convert screen pointer position to normalized [0..1, 0..1]
  const getNormalizedPoint = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { x: 0.5, y: 0.5 };
    const rect = container.getBoundingClientRect();
    const nx = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width));
    const ny = Math.max(0.02, Math.min(0.98, (clientY - rect.top) / rect.height));
    return {
      x: parseFloat(nx.toFixed(3)),
      y: parseFloat(ny.toFixed(3)),
    };
  }, []);

  // Window-level dragging engine ensuring zero dropped pointer events
  const startDragging = useCallback((pin, clientX, clientY) => {
    activePinRef.current = pin;
    setActivePin(pin);

    // Initial positioning update
    const { x, y } = getNormalizedPoint(clientX, clientY);
    if (pin === 'A') {
      lineStartRef.current = [x, y];
      setLineStart([x, y]);
    } else if (pin === 'B') {
      lineEndRef.current = [x, y];
      setLineEnd([x, y]);
    }

    const onPointerMove = (e) => {
      if (!activePinRef.current) return;
      e.preventDefault();
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      if (activePinRef.current === 'A') {
        lineStartRef.current = [pt.x, pt.y];
        setLineStart([pt.x, pt.y]);
      } else if (activePinRef.current === 'B') {
        lineEndRef.current = [pt.x, pt.y];
        setLineEnd([pt.x, pt.y]);
      }
    };

    const onPointerUp = () => {
      activePinRef.current = null;
      setActivePin(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [getNormalizedPoint]);

  // Redraw canvas with high-contrast line and direction indicators
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const ax = lineStart[0] * w;
    const ay = lineStart[1] * h;
    const bx = lineEnd[0] * w;
    const by = lineEnd[1] * h;

    ctx.save();

    // 1. Subtle wide background stroke for easy visibility over any video background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // 2. Primary Vibrant Blue Counting Line
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // 3. Direction vector in the center
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    // Normal arrow pointing toward IN
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + nx * 38, my + ny * 38);
    ctx.stroke();

    // Arrowhead
    const tipX = mx + nx * 38;
    const tipY = my + ny * 38;
    const angle = Math.atan2(ny, nx);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - 10 * Math.cos(angle - Math.PI / 6), tipY - 10 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tipX - 10 * Math.cos(angle + Math.PI / 6), tipY - 10 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // IN Side Label Pill (Green)
    const inDist = 58;
    const inX = mx + nx * inDist;
    const inY = my + ny * inDist;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(inX - 32, inY - 13, 64, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲ IN SIDE', inX, inY);

    // OUT Side Label Pill (Red)
    const outDist = 58;
    const outX = mx - nx * outDist;
    const outY = my - ny * outDist;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(outX - 36, outY - 13, 72, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('▼ OUT SIDE', outX, outY);

    ctx.restore();
  }, [isOpen, lineStart, lineEnd]);

  if (!isOpen) return null;

  // Flip IN / OUT direction
  const handleFlipDirection = async () => {
    const newStart = [...lineEnd];
    const newEnd = [...lineStart];
    lineStartRef.current = newStart;
    lineEndRef.current = newEnd;
    setLineStart(newStart);
    setLineEnd(newEnd);
    try {
      await flipCountingLine('flip');
    } catch (_) {}
  };

  const handleFlipIn = async () => {
    // Normal vector ny = bx - ax
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    // In video coordinates: inward is pointing upward (ny = dx < 0 or towards top)
    // If currently pointing outward, flip to inward
    if (dx > 0) {
      const newStart = [...lineEnd];
      const newEnd = [...lineStart];
      lineStartRef.current = newStart;
      lineEndRef.current = newEnd;
      setLineStart(newStart);
      setLineEnd(newEnd);
    }
    try {
      await flipCountingLine('flip_in');
    } catch (_) {}
  };

  const handleFlipOut = async () => {
    const dx = lineEnd[0] - lineStart[0];
    if (dx < 0) {
      const newStart = [...lineEnd];
      const newEnd = [...lineStart];
      lineStartRef.current = newStart;
      lineEndRef.current = newEnd;
      setLineStart(newStart);
      setLineEnd(newEnd);
    }
    try {
      await flipCountingLine('flip_out');
    } catch (_) {}
  };

  // 1-Click Presets (Corner, Gate, Diagonal, Vertical)
  const applyPreset = (type) => {
    let s = lineStart;
    let e = lineEnd;
    if (type === 'corner') {
      s = [0.06, 0.88];
      e = [0.94, 0.44];
    } else if (type === 'gate') {
      s = [0.05, 0.52];
      e = [0.95, 0.52];
    } else if (type === 'diagonal') {
      s = [0.08, 0.86];
      e = [0.92, 0.18];
    } else if (type === 'vertical') {
      s = [0.50, 0.08];
      e = [0.50, 0.92];
    }
    lineStartRef.current = s;
    lineEndRef.current = e;
    setLineStart(s);
    setLineEnd(e);
  };

  // Save Line to backend API
  const handleSave = async () => {
    setSaving(true);
    try {
      const s = lineStartRef.current;
      const e = lineEndRef.current;
      await updateCountingLine(s, e);
      onSaved?.(s, e);
      onClose();
    } catch (err) {
      console.error('Error saving counting line:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '100%',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <Sliders size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Counting Line Editor
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Drag <strong style={{ color: '#2563eb' }}>Handle A</strong> and <strong style={{ color: '#2563eb' }}>Handle B</strong> directly to position the counting line
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Sandbox Viewport with Interactive Touch Pins */}
        <div
          ref={containerRef}
          onPointerDown={(e) => {
            // Tap/click viewport to drag nearest handle
            const { x, y } = getNormalizedPoint(e.clientX, e.clientY);
            const distA = Math.hypot(x - lineStartRef.current[0], y - lineStartRef.current[1]);
            const distB = Math.hypot(x - lineEndRef.current[0], y - lineEndRef.current[1]);
            if (distA <= distB) {
              startDragging('A', e.clientX, e.clientY);
            } else {
              startDragging('B', e.clientX, e.clientY);
            }
          }}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            backgroundColor: '#020617',
            borderRadius: '14px',
            overflow: 'hidden',
            touchAction: 'none',
            userSelect: 'none',
            cursor: activePin ? 'grabbing' : 'crosshair',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {/* Live Video Reference Feed */}
          <img
            src="/api/video/feed"
            alt="Live Stream Reference"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              pointerEvents: 'none',
              opacity: 0.88,
            }}
          />

          {/* Canvas Overlay for vector line & direction */}
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />

          {/* ── DRAGGABLE HANDLE PIN A (Large 60px Touch Target) ── */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startDragging('A', e.clientX, e.clientY);
            }}
            title="Drag Handle A"
            style={{
              position: 'absolute',
              left: `${lineStart[0] * 100}%`,
              top: `${lineStart[1] * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '60px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: activePin === 'A' ? 'grabbing' : 'grab',
              touchAction: 'none',
              zIndex: 35,
            }}
          >
            {/* Outer pulsating ring */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: activePin === 'A' ? 'rgba(37, 99, 235, 0.45)' : 'rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: activePin === 'A' ? '0 0 0 8px rgba(37, 99, 235, 0.3)' : '0 0 0 4px rgba(37, 99, 235, 0.18)',
                transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                transform: activePin === 'A' ? 'scale(1.15)' : 'scale(1)',
              }}
            >
              {/* Inner core pin badge */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  border: '2.5px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                A
              </div>
            </div>

            {/* Live coordinate readout */}
            <div
              style={{
                position: 'absolute',
                bottom: '-22px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'monospace',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {Math.round(lineStart[0] * 100)}%, {Math.round(lineStart[1] * 100)}%
            </div>
          </div>

          {/* ── DRAGGABLE HANDLE PIN B (Large 60px Touch Target) ── */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startDragging('B', e.clientX, e.clientY);
            }}
            title="Drag Handle B"
            style={{
              position: 'absolute',
              left: `${lineEnd[0] * 100}%`,
              top: `${lineEnd[1] * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '60px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: activePin === 'B' ? 'grabbing' : 'grab',
              touchAction: 'none',
              zIndex: 35,
            }}
          >
            {/* Outer pulsating ring */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: activePin === 'B' ? 'rgba(37, 99, 235, 0.45)' : 'rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: activePin === 'B' ? '0 0 0 8px rgba(37, 99, 235, 0.3)' : '0 0 0 4px rgba(37, 99, 235, 0.18)',
                transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                transform: activePin === 'B' ? 'scale(1.15)' : 'scale(1)',
              }}
            >
              {/* Inner core pin badge */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  border: '2.5px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                B
              </div>
            </div>

            {/* Live coordinate readout */}
            <div
              style={{
                position: 'absolute',
                bottom: '-22px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'monospace',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {Math.round(lineEnd[0] * 100)}%, {Math.round(lineEnd[1] * 100)}%
            </div>
          </div>
        </div>

        {/* Current Coordinates Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.65rem 0.9rem',
            fontSize: '0.82rem',
            color: '#334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
            <span>Point A: <strong>[{lineStart[0]}, {lineStart[1]}]</strong></span>
            <span style={{ color: '#94a3b8' }}>➔</span>
            <span>Point B: <strong>[{lineEnd[0]}, {lineEnd[1]}]</strong></span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            💡 Tip: Touch or drag pins directly
          </span>
        </div>

        {/* Quick Presets & Flow Direction Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginRight: '0.2rem' }}>
              Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('corner')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              🌟 Corner Cut
            </button>
            <button
              type="button"
              onClick={() => applyPreset('gate')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              🚪 Entrance Gate
            </button>
            <button
              type="button"
              onClick={() => applyPreset('diagonal')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              📐 Diagonal
            </button>
            <button
              type="button"
              onClick={() => applyPreset('vertical')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', borderRadius: '8px' }}
            >
              🚹 Vertical
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleFlipDirection}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Flip IN and OUT Flow Direction"
            >
              <ArrowUpDown size={13} />
              <span>Flip IN/OUT</span>
            </button>
            <button
              type="button"
              onClick={handleFlipIn}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px', color: '#059669', borderColor: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Set Inward Flow Direction"
            >
              <ArrowUp size={13} />
              <span>Flip In</span>
            </button>
            <button
              type="button"
              onClick={handleFlipOut}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px', color: '#dc2626', borderColor: '#fecaca', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Set Outward Flow Direction"
            >
              <ArrowDown size={13} />
              <span>Flip Out</span>
            </button>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => {
              const defS = [0.15, 0.72];
              const defE = [0.85, 0.48];
              lineStartRef.current = defS;
              lineEndRef.current = defE;
              setLineStart(defS);
              setLineEnd(defE);
            }}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.85rem',
                padding: '0.5rem 1.4rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                borderRadius: '8px',
              }}
            >
              <Check size={16} />
              <span>{saving ? 'Saving...' : 'Save Counting Line'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
