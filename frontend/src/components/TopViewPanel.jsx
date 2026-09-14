import React, { useRef, useEffect, useState } from 'react';
import { Compass, Users, MapPin, Layers, RefreshCw, Info, ArrowUp, ArrowDown, Sliders, Zap } from 'lucide-react';
import { wsService } from '../services/websocket';
import { updateCountingLine, autoCalibrateFloor } from '../services/api';

const COLOR_PALETTE = [
  '#00F0FF', // Cyan
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#14B8A6', // Teal
  '#F43F5E', // Rose
];

// Helper to draw modern rounded glass pills on Canvas
function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle = null, strokeStyle = null, lineWidth = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

export default function TopViewPanel({ telemetry, onSetCalibrationMode }) {
  const canvasRef = useRef(null);
  const [showInfo, setShowInfo] = useState(false);

  // Flip IN/OUT Line Direction
  const handleFlipLine = () => {
    const line = telemetry?.counting_line;
    if (!line) return;
    const newStart = [...line.end];
    const newEnd = [...line.start];
    updateCountingLine(newStart, newEnd);
    wsService.send('set_counting_line', { start: newStart, end: newEnd });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // 1. Futuristic Dark Gradient Background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 1.2);
    bgGrad.addColorStop(0, '#090F1C');
    bgGrad.addColorStop(1, '#04070D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Calibrated Ground Reference Polygon & Grid
    const pad = 34; // Generous margin so pins and badges never clip
    const gridLeft = pad;
    const gridTop = pad;
    const gridRight = w - pad;
    const gridBottom = h - pad;
    const centerX = w / 2;
    const centerY = h / 2;

    // 3. Compute Divider Position
    const projLine = telemetry?.top_view?.projected_line;
    let dividerY = centerY;

    if (projLine?.norm_start && projLine?.norm_end) {
      const rawY = ((projLine.norm_start[1] + projLine.norm_end[1]) / 2) * h;
      dividerY = Math.max(gridTop + 75, Math.min(gridBottom - 75, rawY));
    }

    // --- A. IN ZONE (Upper Region / Interior) ---
    const inZoneGrad = ctx.createLinearGradient(0, gridTop, 0, dividerY);
    inZoneGrad.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
    inZoneGrad.addColorStop(1, 'rgba(16, 185, 129, 0.04)');
    ctx.fillStyle = inZoneGrad;
    ctx.fillRect(gridLeft, gridTop, gridRight - gridLeft, dividerY - gridTop);

    // IN Zone Boundary
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(gridLeft, gridTop, gridRight - gridLeft, dividerY - gridTop);

    // --- B. OUT ZONE (Lower Region / Exterior) ---
    const outZoneGrad = ctx.createLinearGradient(0, dividerY, 0, gridBottom);
    outZoneGrad.addColorStop(0, 'rgba(244, 63, 94, 0.04)');
    outZoneGrad.addColorStop(1, 'rgba(244, 63, 94, 0.14)');
    ctx.fillStyle = outZoneGrad;
    ctx.fillRect(gridLeft, dividerY, gridRight - gridLeft, gridBottom - dividerY);

    // OUT Zone Boundary
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(gridLeft, dividerY, gridRight - gridLeft, gridBottom - dividerY);

    // --- C. RADAR GRID & METRIC RINGS ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const step = 38;
    for (let x = gridLeft; x <= gridRight; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridBottom);
      ctx.stroke();
    }
    for (let y = gridTop; y <= gridBottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(gridLeft, y);
      ctx.lineTo(gridRight, y);
      ctx.stroke();
    }

    // Concentric Sonar Distance Rings
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    [60, 115, 165].forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.fillText(`${(idx + 1) * 2}m`, centerX + r - 14, centerY - 4);
    });

    // Camera POV Frustum guide lines
    const camX = centerX;
    const camY = h - 14;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(camX, camY);
    ctx.lineTo(gridLeft, gridTop);
    ctx.moveTo(camX, camY);
    ctx.lineTo(gridRight, gridTop);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- D. SLEEK ZONE HEADER BADGES ---
    // 1. IN Zone Glass Pill (Top)
    const inTagY = gridTop + 24;
    drawRoundedRect(
      ctx,
      centerX - 100,
      inTagY - 11,
      200,
      22,
      11,
      'rgba(8, 30, 20, 0.90)',
      '#10B981',
      1.2
    );
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ IN ZONE (FACILITY INTERIOR)', centerX, inTagY + 4);

    // 2. OUT Zone Glass Pill (Bottom)
    const outTagY = gridBottom - 24;
    drawRoundedRect(
      ctx,
      centerX - 100,
      outTagY - 11,
      200,
      22,
      11,
      'rgba(35, 12, 20, 0.90)',
      '#F43F5E',
      1.2
    );
    ctx.fillStyle = '#F43F5E';
    ctx.fillText('▼ OUT ZONE (EXTERIOR ENTRANCE)', centerX, outTagY + 4);
    ctx.textAlign = 'left';

    // =========================================================================
    // --- E. HIGH-TECH OPTICAL LASER COUNTING DIVIDER ---
    // =========================================================================

    // 1. Wide Ambient Glow
    const lineGlow = ctx.createLinearGradient(gridLeft, 0, gridRight, 0);
    lineGlow.addColorStop(0, 'rgba(0, 240, 255, 0.05)');
    lineGlow.addColorStop(0.5, 'rgba(0, 240, 255, 0.35)');
    lineGlow.addColorStop(1, 'rgba(0, 240, 255, 0.05)');

    ctx.strokeStyle = lineGlow;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(gridLeft, dividerY);
    ctx.lineTo(gridRight, dividerY);
    ctx.stroke();

    // 2. Core Laser Beam
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gridLeft, dividerY);
    ctx.lineTo(gridRight, dividerY);
    ctx.stroke();

    // 3. Flow Direction Mini Indicators (clean, spaced out)
    ctx.font = 'bold 8px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
    ctx.fillText('▲ ENTERING', centerX - 140, dividerY - 8);
    ctx.fillText('▲ ENTERING', centerX + 85, dividerY - 8);

    ctx.fillStyle = 'rgba(244, 63, 94, 0.85)';
    ctx.fillText('▼ EXITING', centerX - 140, dividerY + 16);
    ctx.fillText('▼ EXITING', centerX + 85, dividerY + 16);

    // 4. Central Floating Frosted Badge
    const badgeW = 150;
    const badgeH = 22;
    drawRoundedRect(
      ctx,
      centerX - badgeW / 2,
      dividerY - badgeH / 2,
      badgeW,
      badgeH,
      11,
      '#060B14',
      '#00F0FF',
      1.5
    );

    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ COUNTING DIVIDER ⚡', centerX, dividerY + 3);
    ctx.textAlign = 'left';

    // 5. Point A Handle (Left End)
    ctx.fillStyle = '#00F0FF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gridLeft + 10, dividerY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#060B14';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.fillText('A', gridLeft + 7, dividerY + 3);

    // Point A Label above pin
    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 8px JetBrains Mono, monospace';
    ctx.fillText('Point A', gridLeft + 2, dividerY - 12);

    // 6. Point B Handle (Right End)
    ctx.fillStyle = '#00F0FF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gridRight - 10, dividerY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#060B14';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.fillText('B', gridRight - 13, dividerY + 3);

    // Point B Label above pin
    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 8px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Point B', gridRight - 2, dividerY - 12);
    ctx.textAlign = 'left';

    // --- F. 4-CORNER HOMOGRAPHY CALIBRATION PINS ---
    const corners = [
      { label: '① TL', x: gridLeft, y: gridTop, tagX: gridLeft + 12, tagY: gridTop + 14 },
      { label: '② TR', x: gridRight, y: gridTop, tagX: gridRight - 36, tagY: gridTop + 14 },
      { label: '③ BR', x: gridRight, y: gridBottom, tagX: gridRight - 36, tagY: gridBottom - 8 },
      { label: '④ BL', x: gridLeft, y: gridBottom, tagX: gridLeft + 12, tagY: gridBottom - 8 },
    ];

    corners.forEach((c) => {
      // Pin outer ring
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Pin solid dot
      ctx.fillStyle = '#10B981';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tag Label
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText(c.label, c.tagX, c.tagY);
    });

    // Camera POV Marker (Bottom Center)
    drawRoundedRect(
      ctx,
      camX - 48,
      camY - 9,
      96,
      18,
      9,
      'rgba(6, 11, 20, 0.9)',
      '#00F0FF',
      1
    );
    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 8px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('📷 CAMERA POV', camX, camY + 3);
    ctx.textAlign = 'left';

    // --- G. TRACKED ENTITIES MAPPED ON GROUND PLANE ---
    const entities = telemetry?.top_view?.entities || [];

    entities.forEach((entity) => {
      const { track_id, norm_x, norm_y, trail } = entity;
      const color = COLOR_PALETTE[track_id % COLOR_PALETTE.length];

      // Map normalized coordinates into calibrated grid area
      const px = gridLeft + norm_x * (gridRight - gridLeft);
      const py = gridTop + norm_y * (gridBottom - gridTop);

      // Trajectory Trail
      if (trail && trail.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        trail.forEach((pt, i) => {
          const tx = gridLeft + (pt.x / 400) * (gridRight - gridLeft);
          const ty = gridTop + (pt.y / 400) * (gridBottom - gridTop);
          if (i === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        });
        ctx.stroke();

        // Direction Vector Arrow on latest step
        const last = trail[trail.length - 1];
        const prev = trail[trail.length - 2];
        const vdx = last.x - prev.x;
        const vdy = last.y - prev.y;
        const vlen = Math.hypot(vdx, vdy);
        if (vlen > 0.5) {
          const arrowLen = 14;
          const ax = px + (vdx / vlen) * arrowLen;
          const ay = py + (vdy / vlen) * arrowLen;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ax, ay);
          ctx.stroke();
        }
      }

      // Outer radar pulse circle
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing solid core
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();

      // Person Track ID Badge
      drawRoundedRect(
        ctx,
        px + 8,
        py - 14,
        42,
        16,
        4,
        'rgba(7, 10, 17, 0.92)',
        color,
        1
      );
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText(`#${track_id}`, px + 13, py - 2);
    });
  }, [telemetry]);

  const activeCount = telemetry?.top_view?.entities?.length || 0;

  return (
    <div className="glass-panel top-view-panel">
      {/* Panel Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="section-title">
          <Compass size={18} style={{ color: 'var(--accent-cyan)' }} />
          <span>TOP-VIEW 2D MAPPING</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
            title="Explain Top-View Calibration"
          >
            <Info size={12} style={{ color: 'var(--accent-cyan)' }} />
            <span>Guide</span>
          </button>
          <div className="badge" style={{ fontSize: '0.7rem' }}>
            <MapPin size={12} style={{ color: 'var(--accent-emerald)' }} />
            <span>{activeCount} Active</span>
          </div>
        </div>
      </div>

      {/* Calibration Info Box (collapsible) */}
      {showInfo && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: 'rgba(0, 240, 255, 0.05)',
            border: '1px solid var(--border-cyan)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.74rem',
            lineHeight: 1.45,
            color: 'var(--text-muted)',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              marginBottom: '0.3rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Layers size={13} />
            <span>4-Point Homography Ground Calibration & IN/OUT Divider</span>
          </div>
          <div>
            The 4 camera perspective pins <strong>(① TL, ② TR, ③ BR, ④ BL)</strong> map the trapezoid camera floor into this 2D top-view orthographic coordinate space.
          </div>
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.8rem', color: '#fff' }}>
            <span style={{ color: 'var(--accent-emerald)' }}>🟢 Top Zone = Facility Interior (IN)</span>
            <span style={{ color: 'var(--accent-rose)' }}>🔴 Bottom Zone = Exterior (OUT)</span>
          </div>
        </div>
      )}

      {/* Interactive Top View Radar Canvas */}
      <div className="top-view-canvas-wrap">
        <canvas ref={canvasRef} width={400} height={400} className="top-view-canvas" />
      </div>

      {/* Footer Status and Quick Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.72rem',
            color: 'var(--accent-emerald)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span className="pulse-dot" />
          <span>HOMOGRAPHY ACTIVE</span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={async () => {
              await autoCalibrateFloor();
              wsService.send('auto_calibrate');
            }}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}
            title="1-Click Auto-Calibrate Ground Floor"
          >
            <Zap size={11} style={{ color: 'var(--accent-cyan)' }} />
            <span>Auto-Calibrate</span>
          </button>

          <button
            onClick={handleFlipLine}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
            title="Swap IN/OUT Orientation"
          >
            <RefreshCw size={11} />
            <span>Flip IN/OUT</span>
          </button>

          {onSetCalibrationMode && (
            <button
              onClick={() => onSetCalibrationMode('perspective')}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
              title="Open 4-Corner Manual Calibration"
            >
              <Sliders size={11} />
              <span>Calibrate</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
