import React, { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCcw, ArrowUpDown, Sliders, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { updateCountingLine } from '../services/api';

export default function CountingLineEditorModal({
  isOpen,
  onClose,
  initialStart = [0.15, 0.72],
  initialEnd = [0.85, 0.48],
  onSaved,
}) {
  const [lineStart, setLineStart] = useState(initialStart);
  const [lineEnd, setLineEnd] = useState(initialEnd);
  const [saving, setSaving] = useState(false);
  const [activePin, setActivePin] = useState(null); // 'A' | 'B' | 'line' | null

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const dragStartPosRef = useRef(null); // For dragging entire line

  // Sync initial coordinates when modal opens
  useEffect(() => {
    if (isOpen) {
      setLineStart(initialStart || [0.15, 0.72]);
      setLineEnd(initialEnd || [0.85, 0.48]);
    }
  }, [isOpen, initialStart, initialEnd]);

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

  // Helper to convert screen pointer position to normalized [0..1, 0..1]
  const getNormalizedPoint = (clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { x: 0.5, y: 0.5 };
    const rect = container.getBoundingClientRect();
    const nx = Math.max(0.01, Math.min(0.99, (clientX - rect.left) / rect.width));
    const ny = Math.max(0.01, Math.min(0.99, (clientY - rect.top) / rect.height));
    return {
      x: parseFloat(nx.toFixed(3)),
      y: parseFloat(ny.toFixed(3)),
    };
  };

  // Pin A drag handlers with pointer capture
  const handlePinDown = (pin, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePin(pin);
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePinMove = (pin, e) => {
    if (activePin !== pin) return;
    const { x, y } = getNormalizedPoint(e.clientX, e.clientY);
    if (pin === 'A') {
      setLineStart([x, y]);
    } else if (pin === 'B') {
      setLineEnd([x, y]);
    }
  };

  const handlePinUp = (e) => {
    try {
      if (e.target.hasPointerCapture(e.pointerId)) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
    setActivePin(null);
  };

  // Tap anywhere on the viewport to snap nearest corner
  const handleViewportPointerDown = (e) => {
    const { x, y } = getNormalizedPoint(e.clientX, e.clientY);
    const distA = Math.hypot(x - lineStart[0], y - lineStart[1]);
    const distB = Math.hypot(x - lineEnd[0], y - lineEnd[1]);

    if (distA < distB) {
      setLineStart([x, y]);
      setActivePin('A');
    } else {
      setLineEnd([x, y]);
      setActivePin('B');
    }
  };

  const handleViewportPointerMove = (e) => {
    if (!activePin) return;
    const { x, y } = getNormalizedPoint(e.clientX, e.clientY);
    if (activePin === 'A') {
      setLineStart([x, y]);
    } else if (activePin === 'B') {
      setLineEnd([x, y]);
    }
  };

  const handleViewportPointerUp = () => {
    setActivePin(null);
  };

  // Flip IN / OUT direction
  const handleFlipDirection = () => {
    const newStart = [...lineEnd];
    const newEnd = [...lineStart];
    setLineStart(newStart);
    setLineEnd(newEnd);
  };

  const handleFlipIn = () => {
    // Ensure vector points inward
    const newStart = [...lineEnd];
    const newEnd = [...lineStart];
    setLineStart(newStart);
    setLineEnd(newEnd);
  };

  const handleFlipOut = () => {
    // Ensure vector points outward
    const newStart = [...lineEnd];
    const newEnd = [...lineStart];
    setLineStart(newStart);
    setLineEnd(newEnd);
  };

  // 1-Click Presets (Corner, Gate, Diagonal, Vertical)
  const applyPreset = (type) => {
    if (type === 'corner') {
      // From top-left to bottom-right corner
      setLineStart([0.06, 0.88]);
      setLineEnd([0.94, 0.44]);
    } else if (type === 'gate') {
      // Horizontal gate
      setLineStart([0.05, 0.52]);
      setLineEnd([0.95, 0.52]);
    } else if (type === 'diagonal') {
      // Top-right to bottom-left
      setLineStart([0.08, 0.86]);
      setLineEnd([0.92, 0.18]);
    } else if (type === 'vertical') {
      // Vertical turnstile
      setLineStart([0.50, 0.08]);
      setLineEnd([0.50, 0.92]);
    }
  };

  // Save Line to backend API
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCountingLine(lineStart, lineEnd);
      onSaved?.(lineStart, lineEnd);
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
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onPointerCancel={handleViewportPointerUp}
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

          {/* ── DRAGGABLE HANDLE PIN A (Large 56px Touch Target) ── */}
          <div
            onPointerDown={(e) => handlePinDown('A', e)}
            onPointerMove={(e) => handlePinMove('A', e)}
            onPointerUp={handlePinUp}
            onPointerCancel={handlePinUp}
            style={{
              position: 'absolute',
              left: `${lineStart[0] * 100}%`,
              top: `${lineStart[1] * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: activePin === 'A' ? 'grabbing' : 'grab',
              touchAction: 'none',
              zIndex: 30,
            }}
          >
            {/* Outer pulsating ring */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: activePin === 'A' ? 'rgba(37, 99, 235, 0.4)' : 'rgba(37, 99, 235, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: activePin === 'A' ? '0 0 0 8px rgba(37, 99, 235, 0.25)' : '0 0 0 4px rgba(37, 99, 235, 0.15)',
                transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                transform: activePin === 'A' ? 'scale(1.12)' : 'scale(1)',
              }}
            >
              {/* Inner solid badge */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  border: '3px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}
              >
                A
              </div>
            </div>

            {/* Coordinate Tooltip */}
            <div
              style={{
                position: 'absolute',
                bottom: '-20px',
                backgroundColor: 'rgba(15, 23, 42, 0.88)',
                color: '#ffffff',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {Math.round(lineStart[0] * 100)}%, {Math.round(lineStart[1] * 100)}%
            </div>
          </div>

          {/* ── DRAGGABLE HANDLE PIN B (Large 56px Touch Target) ── */}
          <div
            onPointerDown={(e) => handlePinDown('B', e)}
            onPointerMove={(e) => handlePinMove('B', e)}
            onPointerUp={handlePinUp}
            onPointerCancel={handlePinUp}
            style={{
              position: 'absolute',
              left: `${lineEnd[0] * 100}%`,
              top: `${lineEnd[1] * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: activePin === 'B' ? 'grabbing' : 'grab',
              touchAction: 'none',
              zIndex: 30,
            }}
          >
            {/* Outer pulsating ring */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: activePin === 'B' ? 'rgba(37, 99, 235, 0.4)' : 'rgba(37, 99, 235, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: activePin === 'B' ? '0 0 0 8px rgba(37, 99, 235, 0.25)' : '0 0 0 4px rgba(37, 99, 235, 0.15)',
                transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                transform: activePin === 'B' ? 'scale(1.12)' : 'scale(1)',
              }}
            >
              {/* Inner solid badge */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  border: '3px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}
              >
                B
              </div>
            </div>

            {/* Coordinate Tooltip */}
            <div
              style={{
                position: 'absolute',
                bottom: '-20px',
                backgroundColor: 'rgba(15, 23, 42, 0.88)',
                color: '#ffffff',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {Math.round(lineEnd[0] * 100)}%, {Math.round(lineEnd[1] * 100)}%
            </div>
          </div>
        </div>

        {/* Live Coordinate Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.6rem 0.9rem',
            fontSize: '0.82rem',
            color: '#475569',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }}></span>
            <span>Point A: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>[{lineStart[0]}, {lineStart[1]}]</strong></span>
            <span style={{ color: '#cbd5e1' }}>➔</span>
            <span>Point B: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>[{lineEnd[0]}, {lineEnd[1]}]</strong></span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            💡 Tip: Touch or drag pins directly
          </span>
        </div>

        {/* Presets & Direction Flip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('corner')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', minHeight: '34px', borderRadius: '8px' }}
            >
              🌟 Corner Cut
            </button>
            <button
              type="button"
              onClick={() => applyPreset('gate')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', minHeight: '34px', borderRadius: '8px' }}
            >
              🚪 Entrance Gate
            </button>
            <button
              type="button"
              onClick={() => applyPreset('diagonal')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', minHeight: '34px', borderRadius: '8px' }}
            >
              📐 Diagonal
            </button>
            <button
              type="button"
              onClick={() => applyPreset('vertical')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', minHeight: '34px', borderRadius: '8px' }}
            >
              ↕️ Vertical
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleFlipDirection}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Swap IN/OUT Orientation"
            >
              <ArrowUpDown size={13} />
              <span>Flip IN/OUT</span>
            </button>
            <button
              type="button"
              onClick={handleFlipIn}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', minHeight: '34px', borderRadius: '8px', color: '#059669', borderColor: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Set Inward Flow Direction"
            >
              <ArrowUp size={13} />
              <span>Flip In</span>
            </button>
            <button
              type="button"
              onClick={handleFlipOut}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', minHeight: '34px', borderRadius: '8px', color: '#dc2626', borderColor: '#fecaca', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Set Outward Flow Direction"
            >
              <ArrowDown size={13} />
              <span>Flip Out</span>
            </button>
          </div>

        </div>

        {/* Action Buttons: Cancel, Reset, Save Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => {
              setLineStart(initialStart);
              setLineEnd(initialEnd);
            }}
            className="btn btn-secondary"
            style={{ flex: 1, minHeight: '44px' }}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ flex: 1, minHeight: '44px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ flex: 2, minHeight: '44px', fontWeight: 700, fontSize: '0.95rem' }}
          >
            <Check size={18} />
            <span>{saving ? 'Saving...' : 'Save Counting Line'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
