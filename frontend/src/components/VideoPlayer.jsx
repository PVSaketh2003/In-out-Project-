import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, SwitchCamera, Play, Pause, Sliders, AlertCircle, RefreshCw, Loader2, Check, ArrowUpDown, Sparkles } from 'lucide-react';
import { pushClientFrame, controlVideo, updateCountingLine } from '../services/api';

export default function VideoPlayer({
  telemetry,
  onOpenLineEdit,
  onLineUpdated,
  isDeviceCameraActive,
  onToggleFacingMode,
  facingMode,
  sourceName = 'Demo Pedestrian Stream',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [streamError, setStreamError] = useState(false);
  const [streamLoading, setStreamLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());

  // Interactive Line Drag & Drop State
  const initialLine = telemetry?.counting_line || { start: [0.15, 0.72], end: [0.85, 0.48] };
  const [lineStart, setLineStart] = useState(initialLine.start || [0.15, 0.72]);
  const [lineEnd, setLineEnd] = useState(initialLine.end || [0.85, 0.48]);
  const [activePin, setActivePin] = useState(null); // 'A' | 'B' | null
  const [isEditMode, setIsEditMode] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const isDraggingRef = useRef(false);

  // Sync with incoming telemetry only when user is not dragging
  useEffect(() => {
    if (!isDraggingRef.current && telemetry?.counting_line) {
      if (telemetry.counting_line.start) setLineStart(telemetry.counting_line.start);
      if (telemetry.counting_line.end) setLineEnd(telemetry.counting_line.end);
    }
  }, [telemetry?.counting_line]);

  // Draw crisp single counting line on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!lineStart || !lineEnd) return;

    const ax = lineStart[0] * w;
    const ay = lineStart[1] * h;
    const bx = lineEnd[0] * w;
    const by = lineEnd[1] * h;

    ctx.save();

    // 1. Subtle outline glow for maximum visibility on all backgrounds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // 2. Primary Vibrant Blue Counting Line
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // 3. Corner Endpoints (Visual reference when handles not hovered)
    const drawPoint = (x, y, label) => {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      
      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
    };

    drawPoint(ax, ay, 'A');
    drawPoint(bx, by, 'B');

    // 4. Direction indicators in middle of line
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    // Small normal arrow vector pointing towards IN
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + nx * 26, my + ny * 26);
    ctx.stroke();

    // Small IN label
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(mx + nx * 34 - 16, my + ny * 34 - 10, 32, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IN', mx + nx * 34, my + ny * 34);

    // Small OUT label
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(mx - nx * 34 - 20, my - ny * 34 - 10, 40, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('OUT', mx - nx * 34, my - ny * 34);

    ctx.restore();
  }, [lineStart, lineEnd]);

  // Convert screen pointer coordinates to normalized [0..1, 0..1]
  const getNormalizedPoint = useCallback((clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return { x: 0.5, y: 0.5 };
    const rect = container.getBoundingClientRect();
    const nx = Math.max(0.01, Math.min(0.99, (clientX - rect.left) / rect.width));
    const ny = Math.max(0.01, Math.min(0.99, (clientY - rect.top) / rect.height));
    return {
      x: parseFloat(nx.toFixed(3)),
      y: parseFloat(ny.toFixed(3)),
    };
  }, []);

  // Save changes to backend
  const commitLineUpdate = useCallback(async (start, end) => {
    try {
      await updateCountingLine(start, end);
      onLineUpdated?.(start, end);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 2000);
    } catch (err) {
      console.error('Failed to commit counting line:', err);
    }
  }, [onLineUpdated]);

  // Pointer Down on Handle Pin A or B
  const handlePinPointerDown = (pin, e) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setActivePin(pin);
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Pointer Move during dragging
  const handlePinPointerMove = (pin, e) => {
    if (activePin !== pin) return;
    const { x, y } = getNormalizedPoint(e.clientX, e.clientY);
    if (pin === 'A') {
      setLineStart([x, y]);
    } else if (pin === 'B') {
      setLineEnd([x, y]);
    }
  };

  // Pointer Up (Drop handle)
  const handlePinPointerUp = (pin, e) => {
    try {
      if (e.target.hasPointerCapture(e.pointerId)) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
    isDraggingRef.current = false;
    setActivePin(null);
    commitLineUpdate(lineStart, lineEnd);
  };

  // Direct Click/Tap on the video to snap nearest corner
  const handleVideoPointerDown = (e) => {
    // Only snap if edit mode is toggled or user clicked near an endpoint
    if (!isEditMode) return;
    const { x, y } = getNormalizedPoint(e.clientX, e.clientY);
    const distA = Math.hypot(x - lineStart[0], y - lineStart[1]);
    const distB = Math.hypot(x - lineEnd[0], y - lineEnd[1]);

    if (distA < distB) {
      setLineStart([x, y]);
      commitLineUpdate([x, y], lineEnd);
    } else {
      setLineEnd([x, y]);
      commitLineUpdate(lineStart, [x, y]);
    }
  };

  // 1-Click Corner Presets
  const applyPreset = (preset) => {
    let newStart = lineStart;
    let newEnd = lineEnd;
    if (preset === 'corner') {
      // From bottom-left corner to top-right
      newStart = [0.06, 0.88];
      newEnd = [0.94, 0.44];
    } else if (preset === 'gate') {
      // Horizontal gate across doorway
      newStart = [0.05, 0.52];
      newEnd = [0.95, 0.52];
    } else if (preset === 'diagonal') {
      // High diagonal cut
      newStart = [0.08, 0.86];
      newEnd = [0.92, 0.18];
    }
    setLineStart(newStart);
    setLineEnd(newEnd);
    commitLineUpdate(newStart, newEnd);
  };

  // Flip IN / OUT Direction
  const handleFlipDirection = () => {
    const newStart = lineEnd;
    const newEnd = lineStart;
    setLineStart(newStart);
    setLineEnd(newEnd);
    commitLineUpdate(newStart, newEnd);
  };

  // Handle Play/Pause
  const handleTogglePlay = async () => {
    const action = isPaused ? 'resume' : 'pause';
    try {
      await controlVideo(action);
      setIsPaused(!isPaused);
    } catch (e) {
      console.error('Play/pause error:', e);
    }
  };

  const handleReload = () => {
    setStreamError(false);
    setStreamLoading(true);
    setStreamKey(Date.now());
  };

  return (
    <div className="video-card">
      {/* ── Video Viewport (Contain Mode, Direct Corner Drag & Drop) ── */}
      <div
        className="video-wrapper"
        ref={containerRef}
        onPointerDown={handleVideoPointerDown}
        style={{
          position: 'relative',
          cursor: isEditMode ? 'crosshair' : 'default',
          touchAction: 'none',
        }}
      >
        {/* Main AI Stream Image */}
        <img
          ref={imgRef}
          src={`/api/video/feed?t=${streamKey}`}
          alt="VisionEye Live Video Analytics"
          className="video-element"
          onLoad={() => {
            setStreamLoading(false);
            setStreamError(false);
          }}
          onError={() => {
            setStreamLoading(false);
            setStreamError(true);
          }}
        />

        {/* Video Canvas Overlay for Counting Line & Vectors */}
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="canvas-overlay"
          style={{ pointerEvents: 'none' }}
        />

        {/* ── DRAGGABLE CORNER PIN A (Direct Drag & Drop) ── */}
        <div
          onPointerDown={(e) => handlePinPointerDown('A', e)}
          onPointerMove={(e) => handlePinPointerMove('A', e)}
          onPointerUp={(e) => handlePinPointerUp('A', e)}
          onPointerCancel={(e) => handlePinPointerUp('A', e)}
          title="Drag and Drop Point A to position the counting line"
          style={{
            position: 'absolute',
            left: `${lineStart[0] * 100}%`,
            top: `${lineStart[1] * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: activePin === 'A' ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
            zIndex: 35,
          }}
        >
          {/* Outer Pulsing Touch Area */}
          <div
            style={{
              width: isEditMode || activePin === 'A' ? '38px' : '30px',
              height: isEditMode || activePin === 'A' ? '38px' : '30px',
              borderRadius: '50%',
              backgroundColor: activePin === 'A' ? 'rgba(37, 99, 235, 0.45)' : 'rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activePin === 'A' ? '0 0 0 8px rgba(37, 99, 235, 0.3)' : '0 0 0 4px rgba(37, 99, 235, 0.18)',
              transition: 'all 0.15s ease',
              transform: activePin === 'A' ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {/* Inner Handle Disc */}
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                border: '2.5px solid #ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '11px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}
            >
              A
            </div>
          </div>

          {/* Coordinate Tooltip during drag or edit mode */}
          {(isEditMode || activePin === 'A') && (
            <div
              style={{
                position: 'absolute',
                bottom: '-20px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '9px',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              A: {Math.round(lineStart[0] * 100)}%, {Math.round(lineStart[1] * 100)}%
            </div>
          )}
        </div>

        {/* ── DRAGGABLE CORNER PIN B (Direct Drag & Drop) ── */}
        <div
          onPointerDown={(e) => handlePinPointerDown('B', e)}
          onPointerMove={(e) => handlePinPointerMove('B', e)}
          onPointerUp={(e) => handlePinPointerUp('B', e)}
          onPointerCancel={(e) => handlePinPointerUp('B', e)}
          title="Drag and Drop Point B to position the counting line"
          style={{
            position: 'absolute',
            left: `${lineEnd[0] * 100}%`,
            top: `${lineEnd[1] * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: activePin === 'B' ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
            zIndex: 35,
          }}
        >
          {/* Outer Pulsing Touch Area */}
          <div
            style={{
              width: isEditMode || activePin === 'B' ? '38px' : '30px',
              height: isEditMode || activePin === 'B' ? '38px' : '30px',
              borderRadius: '50%',
              backgroundColor: activePin === 'B' ? 'rgba(37, 99, 235, 0.45)' : 'rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activePin === 'B' ? '0 0 0 8px rgba(37, 99, 235, 0.3)' : '0 0 0 4px rgba(37, 99, 235, 0.18)',
              transition: 'all 0.15s ease',
              transform: activePin === 'B' ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {/* Inner Handle Disc */}
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                border: '2.5px solid #ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '11px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}
            >
              B
            </div>
          </div>

          {/* Coordinate Tooltip during drag or edit mode */}
          {(isEditMode || activePin === 'B') && (
            <div
              style={{
                position: 'absolute',
                bottom: '-20px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '9px',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              B: {Math.round(lineEnd[0] * 100)}%, {Math.round(lineEnd[1] * 100)}%
            </div>
          )}
        </div>

        {/* Live "✓ Saved" Floating Toast */}
        {saveSuccessNotice && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              backgroundColor: 'rgba(22, 163, 74, 0.92)',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 40,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <Check size={13} />
            <span>Counting Line Saved</span>
          </div>
        )}

        {/* Quick Drag & Drop Helper Bar (When Edit Mode is active) */}
        {isEditMode && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid #bfdbfe',
              borderRadius: '30px',
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.2)',
              zIndex: 40,
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', marginRight: '4px' }}>
              Drag Corners A/B:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('corner')}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px', borderRadius: '14px' }}
            >
              🌟 Corner
            </button>
            <button
              type="button"
              onClick={() => applyPreset('gate')}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px', borderRadius: '14px' }}
            >
              🚪 Gate
            </button>
            <button
              type="button"
              onClick={handleFlipDirection}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px', borderRadius: '14px' }}
              title="Flip Direction"
            >
              <ArrowUpDown size={11} />
            </button>
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className="btn btn-primary"
              style={{ padding: '2px 10px', fontSize: '11px', minHeight: '26px', borderRadius: '14px' }}
            >
              <Check size={12} />
              <span>Done</span>
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {streamLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              color: '#ffffff',
              gap: '0.6rem',
              zIndex: 10,
            }}
          >
            <Loader2 size={32} className="animate-spin" style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Loading AI Stream...</span>
          </div>
        )}

        {/* Disconnection / Error Overlay */}
        {streamError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: '#ffffff',
              gap: '0.75rem',
              padding: '1rem',
              textAlign: 'center',
              zIndex: 20,
            }}
          >
            <AlertCircle size={36} style={{ color: '#ef4444' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Stream Reconnecting</div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>
                Waiting for the next frame from the camera gateway...
              </p>
            </div>
            <button
              onClick={handleReload}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              <RefreshCw size={14} />
              <span>Retry Stream</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Control Bar Placed Cleanly OUTSIDE Video ── */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxSizing: 'border-box',
        }}
      >
        {/* Left: Source Info & Camera Flip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="badge badge-blue" style={{ fontSize: '0.76rem', padding: '0.3rem 0.65rem' }}>
            <Camera size={13} />
            <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sourceName}
            </span>
          </div>

          {isDeviceCameraActive && (
            <button
              type="button"
              onClick={onToggleFacingMode}
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', minHeight: '34px' }}
              title="Flip Front / Rear Camera"
            >
              <SwitchCamera size={14} />
              <span>Flip</span>
            </button>
          )}
        </div>

        {/* Right: Direct Drag-and-Drop Toggle & Video Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Direct Drag & Drop Corner Line Editing Toggle */}
          <button
            type="button"
            onClick={() => setIsEditMode((prev) => !prev)}
            className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '0.82rem',
              padding: '0.45rem 0.85rem',
              minHeight: '36px',
              backgroundColor: isEditMode ? '#2563eb' : '#eff6ff',
              color: isEditMode ? '#ffffff' : '#2563eb',
              borderColor: isEditMode ? '#2563eb' : '#bfdbfe',
              fontWeight: 600,
            }}
            title="Toggle direct drag and drop line editing on the video"
          >
            <Sliders size={14} />
            <span>{isEditMode ? 'Done Editing' : 'Drag Line on Video'}</span>
          </button>

          {/* Full Line Editor Modal Trigger */}
          <button
            type="button"
            onClick={onOpenLineEdit}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', minHeight: '36px' }}
            title="Open advanced line editor modal"
          >
            <span>Full Editor</span>
          </button>

          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`btn ${isPaused ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '0.82rem',
              padding: '0.45rem 1rem',
              minHeight: '36px',
              fontWeight: 700,
              backgroundColor: isPaused ? '#2563eb' : '#eff6ff',
              color: isPaused ? '#ffffff' : '#2563eb',
              borderColor: isPaused ? '#2563eb' : '#bfdbfe',
            }}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            <span>{isPaused ? 'Start Analytics' : 'Pause'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
