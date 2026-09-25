import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, SwitchCamera, Play, Pause, Sliders, AlertCircle, RefreshCw, Loader2, Check, ArrowUpDown, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { pushClientFrame, controlVideo, updateCountingLine, flipCountingLine } from '../services/api';

export default function VideoPlayer({
  telemetry,
  onOpenLineEdit,
  onLineUpdated,
  isDeviceCameraActive,
  onToggleFacingMode,
  facingMode,
  cameraError = '',
  cameraLoading = false,
  sourceName = 'Demo Pedestrian Stream',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const rendererRef = useRef(null);
  const flipOpRef = useRef(0);

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

  const activePinRef = useRef(null);
  const lineStartRef = useRef(initialLine.start || [0.15, 0.72]);
  const lineEndRef = useRef(initialLine.end || [0.85, 0.48]);

  // Sync with incoming telemetry only when user is not dragging
  useEffect(() => {
    if (!activePinRef.current && telemetry?.counting_line) {
      if (telemetry.counting_line.start) {
        setLineStart(telemetry.counting_line.start);
        lineStartRef.current = telemetry.counting_line.start;
      }
      if (telemetry.counting_line.end) {
        setLineEnd(telemetry.counting_line.end);
        lineEndRef.current = telemetry.counting_line.end;
      }
    }
  }, [telemetry?.counting_line]);

  // Initialize Hardware-Accelerated WebGPU / Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new WebGPURenderer(canvas);
    rendererRef.current.setCountingLine(lineStartRef.current, lineEndRef.current);

    return () => {
      rendererRef.current?.stop();
    };
  }, []);

  // Listen for stream reload events for instant playback on upload completion
  useEffect(() => {
    const onStreamReload = () => {
      setStreamError(false);
      setStreamLoading(true);
      setIsPaused(false);
      setStreamKey(Date.now());
    };
    window.addEventListener('visioneye:stream_reload', onStreamReload);
    return () => {
      window.removeEventListener('visioneye:stream_reload', onStreamReload);
    };
  }, []);

  // Direct, High-Visibility Canvas Rendering of the Counting Line & Direction Vectors
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!lineStart || !lineEnd) return;

    const ax = lineStart[0] * w;
    const ay = lineStart[1] * h;
    const bx = lineEnd[0] * w;
    const by = lineEnd[1] * h;

    ctx.save();

    // 1. Wide high-contrast white background casing
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // 2. Primary Vibrant Blue Counting Line
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // 3. Normal Vector Arrow in Center
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    // Normal arrow shaft
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + nx * 32, my + ny * 32);
    ctx.stroke();

    // Arrowhead
    const tipX = mx + nx * 32;
    const tipY = my + ny * 32;
    const angle = Math.atan2(ny, nx);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - 10 * Math.cos(angle - Math.PI / 6), tipY - 10 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tipX - 10 * Math.cos(angle + Math.PI / 6), tipY - 10 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // IN Side Pill (Green)
    const inDist = 52;
    const inX = mx + nx * inDist;
    const inY = my + ny * inDist;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(inX - 28, inY - 11, 56, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲ IN', inX, inY);

    // OUT Side Pill (Red)
    const outDist = 52;
    const outX = mx - nx * outDist;
    const outY = my - ny * outDist;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(outX - 32, outY - 11, 64, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('▼ OUT', outX, outY);

    ctx.restore();
  }, [lineStart, lineEnd]);

  // Convert screen pointer coordinates to normalized [0..1, 0..1]
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

  // Universal Window-level Drag Engine
  const startDragging = useCallback((pin, clientX, clientY) => {
    activePinRef.current = pin;
    setActivePin(pin);

    const pt = getNormalizedPoint(clientX, clientY);
    if (pin === 'A') {
      lineStartRef.current = [pt.x, pt.y];
      setLineStart([pt.x, pt.y]);
    } else if (pin === 'B') {
      lineEndRef.current = [pt.x, pt.y];
      setLineEnd([pt.x, pt.y]);
    }

    const onPointerMove = (e) => {
      if (!activePinRef.current) return;
      e.preventDefault();
      const nextPt = getNormalizedPoint(e.clientX, e.clientY);
      if (activePinRef.current === 'A') {
        lineStartRef.current = [nextPt.x, nextPt.y];
        setLineStart([nextPt.x, nextPt.y]);
      } else if (activePinRef.current === 'B') {
        lineEndRef.current = [nextPt.x, nextPt.y];
        setLineEnd([nextPt.x, nextPt.y]);
      }
    };

    const onPointerUp = () => {
      activePinRef.current = null;
      setActivePin(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      commitLineUpdate(lineStartRef.current, lineEndRef.current);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [getNormalizedPoint, commitLineUpdate]);

  // 1-Click Corner Presets
  const applyPreset = (preset) => {
    let newStart = lineStart;
    let newEnd = lineEnd;
    if (preset === 'corner') {
      newStart = [0.06, 0.88];
      newEnd = [0.94, 0.44];
    } else if (preset === 'gate') {
      newStart = [0.05, 0.52];
      newEnd = [0.95, 0.52];
    } else if (preset === 'diagonal') {
      newStart = [0.08, 0.86];
      newEnd = [0.92, 0.18];
    }
    lineStartRef.current = newStart;
    lineEndRef.current = newEnd;
    setLineStart(newStart);
    setLineEnd(newEnd);
    commitLineUpdate(newStart, newEnd);
  };

  // Atomic, Race-Free Flip Operations
  const handleFlip = async (action = 'flip') => {
    const currentOp = ++flipOpRef.current;
    let newStart = [...lineEndRef.current];
    let newEnd = [...lineStartRef.current];

    if (action === 'flip_in') {
      const dx = lineEndRef.current[0] - lineStartRef.current[0];
      if (dx > 0) {
        newStart = [...lineEndRef.current];
        newEnd = [...lineStartRef.current];
      } else {
        newStart = [...lineStartRef.current];
        newEnd = [...lineEndRef.current];
      }
    } else if (action === 'flip_out') {
      const dx = lineEndRef.current[0] - lineStartRef.current[0];
      if (dx < 0) {
        newStart = [...lineEndRef.current];
        newEnd = [...lineStartRef.current];
      } else {
        newStart = [...lineStartRef.current];
        newEnd = [...lineEndRef.current];
      }
    }

    lineStartRef.current = newStart;
    lineEndRef.current = newEnd;
    setLineStart(newStart);
    setLineEnd(newEnd);

    try {
      const res = await flipCountingLine(action);
      if (flipOpRef.current === currentOp && res?.counting_line) {
        lineStartRef.current = res.counting_line.start;
        lineEndRef.current = res.counting_line.end;
        setLineStart(res.counting_line.start);
        setLineEnd(res.counting_line.end);
        onLineUpdated?.(res.counting_line.start, res.counting_line.end);
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 2000);
      }
    } catch (err) {
      console.error('Flip counting line error:', err);
    }
  };

  const handleFlipDirection = () => handleFlip('flip');
  const handleFlipIn = () => handleFlip('flip_in');
  const handleFlipOut = () => handleFlip('flip_out');

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
        onPointerDown={(e) => {
          if (!isEditMode) return;
          const pt = getNormalizedPoint(e.clientX, e.clientY);
          const distA = Math.hypot(pt.x - lineStartRef.current[0], pt.y - lineStartRef.current[1]);
          const distB = Math.hypot(pt.x - lineEndRef.current[0], pt.y - lineEndRef.current[1]);
          if (distA <= distB) {
            startDragging('A', e.clientX, e.clientY);
          } else {
            startDragging('B', e.clientX, e.clientY);
          }
        }}
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

        {/* Video Canvas Overlay for Hardware-Accelerated Bounding Boxes & Line */}
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="canvas-overlay"
          style={{ pointerEvents: 'none' }}
        />

        {/* ── DRAGGABLE CORNER PIN A (Direct Drag & Drop) ── */}
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startDragging('A', e.clientX, e.clientY);
          }}
          title="Drag and Drop Point A to position the counting line"
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
            userSelect: 'none',
            zIndex: 35,
          }}
        >
          {/* Outer Pulsing Touch Area */}
          <div
            style={{
              width: isEditMode || activePin === 'A' ? '40px' : '32px',
              height: isEditMode || activePin === 'A' ? '40px' : '32px',
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
                bottom: '-22px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
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
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startDragging('B', e.clientX, e.clientY);
          }}
          title="Drag and Drop Point B to position the counting line"
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
            userSelect: 'none',
            zIndex: 35,
          }}
        >
          {/* Outer Pulsing Touch Area */}
          <div
            style={{
              width: isEditMode || activePin === 'B' ? '40px' : '32px',
              height: isEditMode || activePin === 'B' ? '40px' : '32px',
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
                bottom: '-22px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
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
              maxWidth: '92%',
              overflowX: 'auto',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', marginRight: '4px', whiteSpace: 'nowrap' }}>
              Drag Corners:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('corner')}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px', borderRadius: '14px', whiteSpace: 'nowrap' }}
            >
              🌟 Corner
            </button>
            <button
              type="button"
              onClick={() => applyPreset('gate')}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px', borderRadius: '14px', whiteSpace: 'nowrap' }}
            >
              🚪 Gate
            </button>
            <button
              type="button"
              onClick={handleFlipDirection}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
              title="Flip IN/OUT Flow Direction"
            >
              <ArrowUpDown size={11} />
              <span>Flip IN/OUT</span>
            </button>
            <button
              type="button"
              onClick={handleFlipIn}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px', borderRadius: '14px', color: '#059669', borderColor: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
              title="Set Inward Flow Direction"
            >
              <ArrowUp size={11} />
              <span>Flip In</span>
            </button>
            <button
              type="button"
              onClick={handleFlipOut}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px', minHeight: '26px', borderRadius: '14px', color: '#dc2626', borderColor: '#fecaca', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
              title="Set Outward Flow Direction"
            >
              <ArrowDown size={11} />
              <span>Flip Out</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className="btn btn-primary"
              style={{ padding: '2px 10px', fontSize: '11px', minHeight: '26px', borderRadius: '14px', whiteSpace: 'nowrap' }}
            >
              <Check size={12} />
              <span>Done</span>
            </button>
          </div>
        )}

        {/* Camera Permission / Error Banner */}
        {cameraError && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.95)',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              zIndex: 35,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={16} />
              <span>{cameraError}</span>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {(streamLoading || cameraLoading) && (
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
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {cameraLoading ? 'Opening Device Camera...' : 'Loading AI Stream...'}
            </span>
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
