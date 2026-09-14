import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Maximize2, Shield, Eye, Edit3, Move, Sliders, Layers, CheckCircle2, Zap } from 'lucide-react';
import { updateCountingLine, updatePerspective, applyPerspectivePreset, autoCalibrateFloor } from '../services/api';
import { wsService } from '../services/websocket';

export default function VideoPlayer({ telemetry, calibrationMode, onSetCalibrationMode }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [activeHandle, setActiveHandle] = useState(null); // 'line_start', 'line_end', 'p0', 'p1', 'p2', 'p3'
  const [localLine, setLocalLine] = useState(null);
  const [localPoints, setLocalPoints] = useState(null);

  // Sync initial coordinates from telemetry
  useEffect(() => {
    if (telemetry?.counting_line && !localLine) {
      setLocalLine(telemetry.counting_line);
    }
    if (telemetry?.perspective_points && !localPoints) {
      setLocalPoints(telemetry.perspective_points);
    }
  }, [telemetry]);

  // Handle canvas mouse events for interactive drag-and-drop calibration
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  };

  const handleMouseDown = (e) => {
    if (!calibrationMode) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const [nx, ny] = coords;

    if (calibrationMode === 'line') {
      const line = localLine || telemetry?.counting_line;
      if (!line) return;
      const dStart = Math.hypot(nx - line.start[0], ny - line.start[1]);
      const dEnd = Math.hypot(nx - line.end[0], ny - line.end[1]);

      if (dStart < 0.08) {
        setActiveHandle('line_start');
      } else if (dEnd < 0.08) {
        setActiveHandle('line_end');
      } else {
        // Move line center to clicked position
        const dx = line.end[0] - line.start[0];
        const dy = line.end[1] - line.start[1];
        const newStart = [Math.max(0, Math.min(1, nx - dx / 2)), Math.max(0, Math.min(1, ny - dy / 2))];
        const newEnd = [Math.max(0, Math.min(1, nx + dx / 2)), Math.max(0, Math.min(1, ny + dy / 2))];
        const updated = { start: newStart, end: newEnd };
        setLocalLine(updated);
        updateCountingLine(newStart, newEnd);
        wsService.send('set_counting_line', updated);
      }
    } else if (calibrationMode === 'perspective') {
      const pts = localPoints || telemetry?.perspective_points;
      if (!pts || pts.length !== 4) return;

      for (let i = 0; i < 4; i++) {
        const d = Math.hypot(nx - pts[i][0], ny - pts[i][1]);
        if (d < 0.08) {
          setActiveHandle(`p${i}`);
          break;
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!activeHandle || !calibrationMode) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const [nx, ny] = coords;

    if (calibrationMode === 'line') {
      const line = localLine || telemetry?.counting_line;
      if (!line) return;

      if (activeHandle === 'line_start') {
        const updated = { ...line, start: [nx, ny] };
        setLocalLine(updated);
      } else if (activeHandle === 'line_end') {
        const updated = { ...line, end: [nx, ny] };
        setLocalLine(updated);
      }
    } else if (calibrationMode === 'perspective') {
      const pts = [...(localPoints || telemetry?.perspective_points)];
      const idx = parseInt(activeHandle.replace('p', ''));
      if (!isNaN(idx) && idx >= 0 && idx < 4) {
        pts[idx] = [nx, ny];
        setLocalPoints(pts);
      }
    }
  };

  const handleMouseUp = () => {
    if (!activeHandle) return;

    if (calibrationMode === 'line' && localLine) {
      updateCountingLine(localLine.start, localLine.end);
      wsService.send('set_counting_line', localLine);
    } else if (calibrationMode === 'perspective' && localPoints) {
      updatePerspective(localPoints);
      wsService.send('set_perspective', { points: localPoints });
    }

    setActiveHandle(null);
  };

  const handleFlipLine = () => {
    const line = localLine || telemetry?.counting_line;
    if (!line) return;
    const updated = { start: [...line.end], end: [...line.start] };
    setLocalLine(updated);
    updateCountingLine(updated.start, updated.end);
    wsService.send('set_counting_line', updated);
  };

  // Draw interactive calibration handles on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (calibrationMode === 'line') {
      const line = localLine || telemetry?.counting_line;
      if (line) {
        const sx = line.start[0] * w;
        const sy = line.start[1] * h;
        const ex = line.end[0] * w;
        const ey = line.end[1] * h;

        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        const dx = ex - sx;
        const dy = ey - sy;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        // Draw normal arrows and side labels
        const arrowDist = 55;
        const inX = mx + nx * arrowDist;
        const inY = my + ny * arrowDist;
        const outX = mx - nx * arrowDist;
        const outY = my - ny * arrowDist;

        // IN Arrow & Banner (Green)
        ctx.strokeStyle = '#10B981';
        ctx.fillStyle = '#10B981';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(inX, inY);
        ctx.stroke();

        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillStyle = '#06281E';
        ctx.fillRect(inX - 95, inY - 14, 190, 28);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.strokeRect(inX - 95, inY - 14, 190, 28);
        ctx.fillStyle = '#10B981';
        ctx.textAlign = 'center';
        ctx.fillText('▲ IN (ENTERING / INSIDE)', inX, inY + 5);

        // OUT Arrow & Banner (Rose/Red)
        ctx.strokeStyle = '#F43F5E';
        ctx.fillStyle = '#F43F5E';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(outX, outY);
        ctx.stroke();

        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillStyle = '#2D0A14';
        ctx.fillRect(outX - 95, outY - 14, 190, 28);
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 2;
        ctx.strokeRect(outX - 95, outY - 14, 190, 28);
        ctx.fillStyle = '#F43F5E';
        ctx.fillText('▼ OUT (EXITING / OUTSIDE)', outX, outY + 5);
        ctx.textAlign = 'left';

        // Line with glowing cyan stroke
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Start point handle (A)
        ctx.fillStyle = '#00F0FF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#070B13';
        ctx.font = 'bold 12px JetBrains Mono, monospace';
        ctx.fillText('A', sx - 4, sy + 4);

        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillStyle = '#00F0FF';
        ctx.fillText('Point A (Start)', sx + 18, sy + 4);

        // End point handle (B)
        ctx.fillStyle = '#00F0FF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex, ey, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#070B13';
        ctx.fillText('B', ex - 4, ey + 4);

        ctx.fillStyle = '#00F0FF';
        ctx.fillText('Point B (End)', ex + 18, ey + 4);

        // Instructions banner at bottom
        ctx.fillStyle = 'rgba(7, 10, 17, 0.92)';
        ctx.fillRect(20, h - 45, 620, 32);
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(20, h - 45, 620, 32);
        ctx.fillStyle = '#00F0FF';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('⚡ LINE EDITING: DRAG POINT A & B HANDLES • APPLIES INSTANTLY • CLICK DONE TO SAVE', 30, h - 25);
      }
    } else if (calibrationMode === 'perspective') {
      const pts = localPoints || telemetry?.perspective_points;
      if (pts && pts.length === 4) {
        const pixelPts = pts.map((p) => [p[0] * w, p[1] * h]);

        // Draw translucent ground quadrilateral
        ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
        ctx.beginPath();
        ctx.moveTo(pixelPts[0][0], pixelPts[0][1]);
        ctx.lineTo(pixelPts[1][0], pixelPts[1][1]);
        ctx.lineTo(pixelPts[2][0], pixelPts[2][1]);
        ctx.lineTo(pixelPts[3][0], pixelPts[3][1]);
        ctx.closePath();
        ctx.fill();

        // Internal ground perspective grid lines (4x4 division)
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;
        for (const f of [0.25, 0.5, 0.75]) {
          // Vertical perspective lines
          const tx = pixelPts[0][0] + (pixelPts[1][0] - pixelPts[0][0]) * f;
          const ty = pixelPts[0][1] + (pixelPts[1][1] - pixelPts[0][1]) * f;
          const bx = pixelPts[3][0] + (pixelPts[2][0] - pixelPts[3][0]) * f;
          const by = pixelPts[3][1] + (pixelPts[2][1] - pixelPts[3][1]) * f;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(bx, by);
          ctx.stroke();

          // Horizontal perspective lines
          const lx = pixelPts[0][0] + (pixelPts[3][0] - pixelPts[0][0]) * f;
          const ly = pixelPts[0][1] + (pixelPts[3][1] - pixelPts[0][1]) * f;
          const rx = pixelPts[1][0] + (pixelPts[2][0] - pixelPts[1][0]) * f;
          const ry = pixelPts[1][1] + (pixelPts[2][1] - pixelPts[1][1]) * f;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(rx, ry);
          ctx.stroke();
        }

        // Polygon outline
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Corner handles
        const labels = ['① TOP-LEFT (TL)', '② TOP-RIGHT (TR)', '③ BOTTOM-RIGHT (BR)', '④ BOTTOM-LEFT (BL)'];
        pixelPts.forEach((p, idx) => {
          const [px, py] = p;

          // Outer pulse ring
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(px, py, 18, 0, Math.PI * 2);
          ctx.stroke();

          // Inner solid handle
          ctx.fillStyle = '#10B981';
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();

          // Label badge
          const label = labels[idx];
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.fillStyle = 'rgba(7, 10, 17, 0.92)';
          ctx.fillRect(px + 20, py - 13, 150, 24);
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 20, py - 13, 150, 24);
          ctx.fillStyle = '#10B981';
          ctx.fillText(label, px + 26, py + 4);
        });

        // Instructions banner at bottom
        ctx.fillStyle = 'rgba(7, 10, 17, 0.92)';
        ctx.fillRect(20, h - 45, 680, 32);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(20, h - 45, 680, 32);
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('⚡ 4-PT CALIBRATION: DRAG ANY OF THE 4 CORNERS (TL, TR, BR, BL) • APPLIES INSTANTLY • CLICK DONE TO SAVE', 30, h - 25);
      }
    }
  }, [calibrationMode, localLine, localPoints, telemetry]);

  const [streamErrorCount, setStreamErrorCount] = useState(0);

  const getStreamSrc = () => {
    if (streamErrorCount >= 2) {
      return `${window.location.protocol}//${window.location.hostname}:8000/api/video/feed?t=${Date.now()}`;
    }
    return `/api/video/feed?t=${Date.now()}`;
  };

  // Auto-reload stream when source changes
  useEffect(() => {
    if (imgRef.current) {
      imgRef.current.src = getStreamSrc();
    }
  }, [telemetry?.source?.source_path, telemetry?.source?.source_type]);

  const sourceName = telemetry?.source?.source_type || 'Synthetic Stream';
  const isPrivacyActive = telemetry?.privacy?.enabled;
  const resParts = (telemetry?.resolution || '1280x720').split('x');
  const canvasWidth = parseInt(resParts[0]) || 1280;
  const canvasHeight = parseInt(resParts[1]) || 720;

  return (
    <div className="glass-panel video-panel" ref={containerRef}>
      <div className="video-container">
        {/* Live MJPEG Feed from Backend */}
        <img
          ref={imgRef}
          src="/api/video/feed"
          alt="VisionEye Live Camera Stream"
          className="video-element"
          onLoad={() => setStreamErrorCount(0)}
          onError={(e) => {
            setStreamErrorCount((c) => c + 1);
            setTimeout(() => {
              if (e.target) {
                e.target.src = getStreamSrc();
              }
            }, 500);
          }}
        />

        {/* Interactive Overlay Canvas */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="canvas-overlay"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Top Floating HUD Bar */}
        <div className="video-hud-top">
          <div style={{ display: 'flex', gap: '0.5rem', pointerEvents: 'auto' }}>
            <div className="hud-tag" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
              <Camera size={13} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ textTransform: 'uppercase' }}>{sourceName}</span>
            </div>

            {isPrivacyActive && (
              <div className="hud-tag" style={{ borderLeft: '3px solid var(--accent-rose)', color: 'var(--accent-rose)' }}>
                <Shield size={13} />
                <span>PRIVACY: {telemetry?.privacy?.mode.toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Real-Time Live IN / OUT / Inside Counts on HUD */}
          <div style={{ display: 'flex', gap: '0.4rem', pointerEvents: 'auto' }}>
            <div className="hud-tag" style={{ borderLeft: '3px solid var(--accent-emerald)', color: '#10B981', fontWeight: 700 }}>
              <span>IN: {telemetry?.total_in ?? 0}</span>
            </div>
            <div className="hud-tag" style={{ borderLeft: '3px solid var(--accent-rose)', color: '#F43F5E', fontWeight: 700 }}>
              <span>OUT: {telemetry?.total_out ?? 0}</span>
            </div>
            <div className="hud-tag" style={{ borderLeft: '3px solid var(--accent-cyan)', color: '#00F0FF', fontWeight: 700 }}>
              <span>INSIDE: {telemetry?.occupancy ?? 0}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', pointerEvents: 'auto' }}>
            {calibrationMode ? (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {calibrationMode === 'line' && (
                  <button
                    onClick={handleFlipLine}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem' }}
                    title="Swap IN/OUT Orientation"
                  >
                    <RefreshCw size={12} />
                    <span>Flip IN/OUT</span>
                  </button>
                )}
                {calibrationMode === 'perspective' && (
                  <button
                    onClick={async () => {
                      await autoCalibrateFloor();
                      wsService.send('auto_calibrate');
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.74rem',
                      color: 'var(--accent-cyan)',
                      borderColor: 'rgba(0, 240, 255, 0.4)',
                    }}
                    title="1-Click Auto Calibrate Ground Floor"
                  >
                    <Zap size={12} style={{ color: 'var(--accent-cyan)' }} />
                    <span>⚡ Auto-Calibrate</span>
                  </button>
                )}
                <button
                  onClick={() => onSetCalibrationMode(null)}
                  className="btn btn-primary"
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    background: '#10B981',
                    color: '#06281E',
                    border: '1px solid #10B981',
                    boxShadow: '0 0 14px rgba(16, 185, 129, 0.5)',
                  }}
                >
                  <CheckCircle2 size={13} />
                  <span>✓ Finish Calibration</span>
                </button>
              </div>
            ) : (
              <div className="hud-tag" style={{ color: 'var(--accent-emerald)' }}>
                <span className="pulse-dot" />
                <span>LIVE CV PIPELINE</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
