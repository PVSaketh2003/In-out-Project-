import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Shield, CheckCircle2, Zap, SwitchCamera, AlertCircle, X, Maximize2 } from 'lucide-react';
import { updateCountingLine, updatePerspective, applyPerspectivePreset, autoCalibrateFloor, pushClientFrame } from '../services/api';
import { wsService } from '../services/websocket';

// ─── Simple global error logger ─────────────────────────────────────────────
const errorLogs = [];
const errorListeners = [];

export function logError(source, msg, detail) {
  const entry = {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString(),
    source,
    msg: String(msg),
    detail: detail ? String(detail) : '',
  };
  errorLogs.unshift(entry);
  if (errorLogs.length > 30) errorLogs.pop();
  errorListeners.forEach(fn => fn([...errorLogs]));
}

export function useErrorLog() {
  const [logs, setLogs] = useState([...errorLogs]);
  useEffect(() => {
    errorListeners.push(setLogs);
    return () => {
      const idx = errorListeners.indexOf(setLogs);
      if (idx !== -1) errorListeners.splice(idx, 1);
    };
  }, []);
  return [logs, () => { errorLogs.length = 0; errorListeners.forEach(fn => fn([])); }];
}

// ─── Stream URL helper ────────────────────────────────────────────────────────
function getStreamSrc() {
  const ts = Date.now();
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/video/feed?t=${ts}`;
  }
  return `/api/video/feed?t=${ts}`;
}

export default function VideoPlayer({ telemetry, calibrationMode, onSetCalibrationMode }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const videoDeviceRef = useRef(null);
  const offscreenCanvasRef = useRef(null);

  const [activeHandle, setActiveHandle] = useState(null);
  const [localLine, setLocalLine] = useState(null);
  const [localPoints, setLocalPoints] = useState(null);
  const [isDeviceCameraActive, setIsDeviceCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // Default 'user' works on both laptops & mobile
  const [cameraError, setCameraError] = useState('');
  const [streamError, setStreamError] = useState(false);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [errorLogs, clearErrors] = useErrorLog();
  const [streamKey, setStreamKey] = useState(Date.now());

  // ── Telemetry sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (telemetry?.counting_line && !localLine) setLocalLine(telemetry.counting_line);
    if (telemetry?.perspective_points && !localPoints) setLocalPoints(telemetry.perspective_points);
  }, [telemetry]);

  // ── Reload MJPEG stream smoothly ────────────────────────────────────────────
  const reloadStream = () => {
    setStreamError(false);
    setStreamKey(Date.now());
  };

  // Reload stream when source changes in telemetry
  const prevSourceRef = useRef(null);
  useEffect(() => {
    const currentSource = `${telemetry?.source?.source_type}|${telemetry?.source?.source_path}`;
    if (prevSourceRef.current !== null && prevSourceRef.current !== currentSource) {
      logError('Stream', `Switched to: ${telemetry?.source?.source_type || 'live stream'}`, telemetry?.source?.source_path);
      reloadStream();
    }
    prevSourceRef.current = currentSource;
  }, [telemetry?.source?.source_type, telemetry?.source?.source_path]);

  // ── Custom events ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleReload = () => reloadStream();
    const handleCameraToggle = (e) => {
      if (e.detail?.active) startDeviceCamera();
      else stopDeviceCamera();
    };
    window.addEventListener('visioneye:stream_reload', handleReload);
    window.addEventListener('visioneye:device_camera_toggle', handleCameraToggle);
    return () => {
      window.removeEventListener('visioneye:stream_reload', handleReload);
      window.removeEventListener('visioneye:device_camera_toggle', handleCameraToggle);
    };
  }, [facingMode]);

  // ── Universal Laptop & Mobile Camera ────────────────────────────────────────
  const startDeviceCamera = async (overrideFacing) => {
    setCameraError('');
    const targetFacing = overrideFacing || facingMode;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API requires HTTPS or localhost.');
      }
      stopDeviceCamera();

      let stream;
      try {
        // Try with ideal facing mode
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetFacing ? { ideal: targetFacing } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch (firstErr) {
        // Fallback for laptop webcams without facingMode support
        console.warn('Retrying camera with generic constraints...', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (videoDeviceRef.current) {
        videoDeviceRef.current.srcObject = stream;
        try {
          await videoDeviceRef.current.play();
        } catch (e) {
          logError('Camera', 'Video play error', e.message);
        }
      }
      setIsDeviceCameraActive(true);
      logError('Camera', `Live camera active: ${targetFacing || 'default'}`, '');
    } catch (err) {
      const isPermission = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isPermission
        ? 'Camera permission denied. Please allow camera access in your browser.'
        : `Camera unavailable: ${err.message || 'No camera found or device is busy.'}`;
      setCameraError(msg);
      logError('Camera', msg, err.name);
      setIsDeviceCameraActive(false);
    }
  };

  const stopDeviceCamera = () => {
    if (videoDeviceRef.current?.srcObject) {
      try {
        videoDeviceRef.current.srcObject.getTracks().forEach(t => t.stop());
      } catch (e) {}
      videoDeviceRef.current.srcObject = null;
    }
    setIsDeviceCameraActive(false);
  };

  const handleToggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startDeviceCamera(next);
  };

  // ── Frame push loop (Laptop / Mobile Camera → AI Backend) ───────────────────
  useEffect(() => {
    if (!isDeviceCameraActive) return;
    let busy = false;
    const iv = setInterval(() => {
      if (busy || !videoDeviceRef.current || !offscreenCanvasRef.current) return;
      const vid = videoDeviceRef.current;
      if (vid.readyState < 2 || vid.videoWidth === 0) return;
      const canvas = offscreenCanvasRef.current;
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(vid, 0, 0, 640, 480);
      const b64 = canvas.toDataURL('image/jpeg', 0.65);
      busy = true;
      pushClientFrame(b64)
        .catch(e => logError('FramePush', 'Frame push error', e.message))
        .finally(() => { busy = false; });
    }, 66); // ~15 FPS push
    return () => clearInterval(iv);
  }, [isDeviceCameraActive]);

  // ── Canvas coordinate mapping ───────────────────────────────────────────────
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [
      Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    ];
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
      if (dStart < 0.08) setActiveHandle('line_start');
      else if (dEnd < 0.08) setActiveHandle('line_end');
      else {
        const dx = line.end[0] - line.start[0], dy = line.end[1] - line.start[1];
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
        if (Math.hypot(nx - pts[i][0], ny - pts[i][1]) < 0.08) {
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
      if (activeHandle === 'line_start') setLocalLine({ ...line, start: [nx, ny] });
      else if (activeHandle === 'line_end') setLocalLine({ ...line, end: [nx, ny] });
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

  // ── Canvas overlay rendering for calibration & virtual lines ────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (calibrationMode === 'line') {
      const line = localLine || telemetry?.counting_line;
      if (!line) return;
      const sx = line.start[0] * w, sy = line.start[1] * h, ex = line.end[0] * w, ey = line.end[1] * h;
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, arrowDist = 50;
      const inX = mx + nx * arrowDist, inY = my + ny * arrowDist;
      const outX = mx - nx * arrowDist, outY = my - ny * arrowDist;

      // IN Arrow
      ctx.strokeStyle = '#10B981'; ctx.fillStyle = '#10B981'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(inX, inY); ctx.stroke();
      ctx.font = 'bold 12px Inter,sans-serif'; ctx.fillStyle = '#06281E';
      ctx.fillRect(inX - 80, inY - 12, 160, 24);
      ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1.5; ctx.strokeRect(inX - 80, inY - 12, 160, 24);
      ctx.fillStyle = '#10B981'; ctx.textAlign = 'center'; ctx.fillText('▲ IN (ENTERING)', inX, inY + 4);

      // OUT Arrow
      ctx.strokeStyle = '#F43F5E'; ctx.fillStyle = '#F43F5E'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(outX, outY); ctx.stroke();
      ctx.fillStyle = '#2D0A14'; ctx.fillRect(outX - 80, outY - 12, 160, 24);
      ctx.strokeStyle = '#F43F5E'; ctx.lineWidth = 1.5; ctx.strokeRect(outX - 80, outY - 12, 160, 24);
      ctx.fillStyle = '#F43F5E'; ctx.fillText('▼ OUT (EXITING)', outX, outY + 4); ctx.textAlign = 'left';

      // Counting line
      ctx.strokeStyle = 'rgba(0,240,255,0.4)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

      // Handles A and B
      [[sx, sy, 'A'], [ex, ey, 'B']].forEach(([px, py, lbl], i) => {
        ctx.fillStyle = '#00F0FF'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#070B13'; ctx.font = 'bold 11px JetBrains Mono,monospace'; ctx.fillText(lbl, px - 3.5, py + 3.5);
      });
    } else if (calibrationMode === 'perspective') {
      const pts = localPoints || telemetry?.perspective_points;
      if (!pts || pts.length !== 4) return;
      const pxPts = pts.map(p => [p[0] * w, p[1] * h]);
      ctx.fillStyle = 'rgba(0,240,255,0.15)'; ctx.beginPath();
      ctx.moveTo(pxPts[0][0], pxPts[0][1]); ctx.lineTo(pxPts[1][0], pxPts[1][1]);
      ctx.lineTo(pxPts[2][0], pxPts[2][1]); ctx.lineTo(pxPts[3][0], pxPts[3][1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#00F0FF'; ctx.lineWidth = 2.5;
      ctx.beginPath(); pxPts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
      ['① TL', '② TR', '③ BR', '④ BL'].forEach((lbl, i) => {
        const [px, py] = pxPts[i];
        ctx.strokeStyle = '#10B981'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#10B981'; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
        ctx.font = 'bold 11px JetBrains Mono,monospace'; ctx.fillStyle = 'rgba(7,10,17,0.9)';
        ctx.fillRect(px + 14, py - 10, 80, 20); ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1; ctx.strokeRect(px + 14, py - 10, 80, 20);
        ctx.fillStyle = '#10B981'; ctx.fillText(lbl, px + 18, py + 4);
      });
    }
  }, [calibrationMode, localLine, localPoints, telemetry]);

  const sourceName = isDeviceCameraActive
    ? `Laptop/Device Cam (${facingMode === 'user' ? 'Front' : 'Rear'})`
    : (telemetry?.source?.source_type === 'file'
      ? `Video File (${telemetry?.source?.source_path?.split('/').pop() || 'Uploaded'})`
      : (telemetry?.source?.source_type === 'synthetic' ? 'Demo Stream' : 'Live Camera'));

  const resParts = (telemetry?.resolution || '1280x720').split('x');
  const canvasWidth = parseInt(resParts[0]) || 1280;
  const canvasHeight = parseInt(resParts[1]) || 720;

  return (
    <div className="glass-panel video-panel" ref={containerRef} style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="video-container" style={{ position: 'relative', background: '#030712', borderRadius: '12px', minHeight: '380px' }}>
        {/* Hidden camera capture video element */}
        <video ref={videoDeviceRef} autoPlay playsInline muted style={{ display: 'none', position: 'absolute', width: 1, height: 1, opacity: 0 }} />
        <canvas ref={offscreenCanvasRef} style={{ display: 'none' }} />

        {/* ── Main Clean Video Stream ── */}
        <img
          key={streamKey}
          ref={imgRef}
          src={getStreamSrc()}
          alt="VisionEye Live Stream"
          className="video-element"
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '12px' }}
          onError={() => {
            setStreamError(true);
            setTimeout(() => {
              if (imgRef.current) imgRef.current.src = getStreamSrc();
            }, 1500);
          }}
        />

        {/* ── Error Banner (Only shown if feed genuinely disconnected) ── */}
        {streamError && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(6,9,19,0.88)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.75rem', zIndex: 20
          }}>
            <AlertCircle size={32} style={{ color: 'var(--accent-rose)' }} />
            <span style={{ color: '#FFF', fontWeight: 600, fontSize: '0.9rem' }}>
              Reconnecting to Live Stream...
            </span>
            <button onClick={reloadStream} className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
              <RefreshCw size={12} style={{ marginRight: '0.3rem' }} /> Refresh Stream
            </button>
          </div>
        )}

        {/* ── Camera Permission / Error Warning ── */}
        {cameraError && (
          <div style={{
            position: 'absolute', top: '50px', left: '10px', right: '10px',
            background: 'rgba(244,63,94,0.95)', color: '#FFF', padding: '0.6rem 0.85rem',
            borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', zIndex: 25
          }}>
            <span>⚠️ {cameraError}</span>
            <button onClick={() => setCameraError('')} style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* ── Interactive calibration canvas overlay ── */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="canvas-overlay"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: calibrationMode ? 'auto' : 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />

        {/* ── Sleek Non-Intrusive Top HUD Bar ── */}
        <div className="video-hud-top" style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ display: 'flex', gap: '0.4rem', pointerEvents: 'auto', alignItems: 'center' }}>
            <div className="hud-tag" style={{ background: 'rgba(7,10,19,0.8)', border: '1px solid rgba(0,240,255,0.3)', color: '#00F0FF', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Camera size={12} />
              <span>{sourceName}</span>
            </div>

            {isDeviceCameraActive && (
              <button
                onClick={handleToggleFacingMode}
                className="btn btn-secondary"
                style={{ padding: '0.22rem 0.5rem', fontSize: '0.7rem', background: 'rgba(0,240,255,0.15)', borderColor: '#00F0FF' }}
                title="Switch Front/Rear Camera"
              >
                <SwitchCamera size={11} /> Flip Cam
              </button>
            )}
          </div>

          {/* Quick Real-Time Occupancy Summary on Video */}
          <div style={{ display: 'flex', gap: '0.35rem', pointerEvents: 'auto' }}>
            <div className="hud-tag" style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid #10B981', color: '#10B981', fontWeight: 700, padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem' }}>
              IN: {telemetry?.total_in ?? 0}
            </div>
            <div className="hud-tag" style={{ background: 'rgba(244,63,94,0.2)', border: '1px solid #F43F5E', color: '#F43F5E', fontWeight: 700, padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem' }}>
              OUT: {telemetry?.total_out ?? 0}
            </div>
            <div className="hud-tag" style={{ background: 'rgba(0,240,255,0.2)', border: '1px solid #00F0FF', color: '#00F0FF', fontWeight: 700, padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem' }}>
              INSIDE: {telemetry?.occupancy ?? 0}
            </div>

            {calibrationMode && (
              <button
                onClick={() => onSetCalibrationMode(null)}
                className="btn btn-primary"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem', background: '#10B981', color: '#000', fontWeight: 700 }}
              >
                <CheckCircle2 size={12} /> Save Line
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
