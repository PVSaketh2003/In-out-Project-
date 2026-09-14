import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Shield, CheckCircle2, Zap, SwitchCamera, AlertCircle, X } from 'lucide-react';
import { updateCountingLine, updatePerspective, applyPerspectivePreset, autoCalibrateFloor, pushClientFrame } from '../services/api';
import { wsService } from '../services/websocket';

// ─── Simple global error logger so we can show errors in the UI ─────────────
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
  const streamTimeoutRef = useRef(null);

  const [activeHandle, setActiveHandle] = useState(null);
  const [localLine, setLocalLine] = useState(null);
  const [localPoints, setLocalPoints] = useState(null);
  const [isDeviceCameraActive, setIsDeviceCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [streamErrorCount, setStreamErrorCount] = useState(0);
  const [streamStatus, setStreamStatus] = useState('loading'); // 'loading' | 'live' | 'error'
  const [cameraError, setCameraError] = useState('');
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [errorLogs, clearErrors] = useErrorLog();

  // ── Telemetry sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (telemetry?.counting_line && !localLine) setLocalLine(telemetry.counting_line);
    if (telemetry?.perspective_points && !localPoints) setLocalPoints(telemetry.perspective_points);
  }, [telemetry]);

  // ── Reload MJPEG stream (robust: use a new timestamp, auto-clear spinner) ──
  const reloadStream = () => {
    if (!imgRef.current) return;
    setStreamStatus('loading');
    // Clear any old timeout
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    // Force-reload MJPEG by changing src
    imgRef.current.src = '';
    requestAnimationFrame(() => {
      if (imgRef.current) imgRef.current.src = getStreamSrc();
    });
    // Auto-clear spinner after 4s (MJPEG does not fire onLoad reliably on all browsers)
    streamTimeoutRef.current = setTimeout(() => {
      setStreamStatus('live');
    }, 4000);
  };

  // Initial stream load
  useEffect(() => {
    reloadStream();
    return () => { if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current); };
  }, []);

  // Reload stream when source type or path changes
  const prevSourceRef = useRef(null);
  useEffect(() => {
    const currentSource = `${telemetry?.source?.source_type}|${telemetry?.source?.source_path}`;
    if (prevSourceRef.current !== null && prevSourceRef.current !== currentSource) {
      logError('Stream', `Source changed to: ${telemetry?.source?.source_type || 'unknown'}`, telemetry?.source?.source_path);
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

  // ── Device camera ────────────────────────────────────────────────────────────
  const startDeviceCamera = async (overrideFacing) => {
    setCameraError('');
    const targetFacing = overrideFacing || facingMode;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported. HTTPS is required.');
      }
      stopDeviceCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: targetFacing }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoDeviceRef.current) {
        videoDeviceRef.current.srcObject = stream;
        try { await videoDeviceRef.current.play(); } catch (e) {
          logError('Camera', 'Video play error', e.message);
        }
      }
      setIsDeviceCameraActive(true);
      logError('Camera', `Camera started: ${targetFacing} lens`, '');
    } catch (err) {
      const isPermission = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isPermission
        ? 'Camera permission denied. Tap the camera icon in your browser address bar and allow access.'
        : `Camera unavailable: ${err.message || 'Device busy or no camera found.'}`;
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

  // ── Frame push loop (mobile camera → backend) ────────────────────────────────
  useEffect(() => {
    if (!isDeviceCameraActive) return;
    let busy = false;
    const iv = setInterval(() => {
      if (busy || !videoDeviceRef.current || !offscreenCanvasRef.current) return;
      const vid = videoDeviceRef.current;
      if (vid.readyState < 2 || vid.videoWidth === 0) return;
      const canvas = offscreenCanvasRef.current;
      canvas.width = 640; canvas.height = 480;
      canvas.getContext('2d').drawImage(vid, 0, 0, 640, 480);
      const b64 = canvas.toDataURL('image/jpeg', 0.65);
      busy = true;
      pushClientFrame(b64)
        .catch(e => logError('FramePush', 'Frame push failed', e.message))
        .finally(() => { busy = false; });
    }, 66);
    return () => clearInterval(iv);
  }, [isDeviceCameraActive]);

  // ── Canvas drawing for calibration ──────────────────────────────────────────
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // support touch
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
        setLocalLine(updated); updateCountingLine(newStart, newEnd); wsService.send('set_counting_line', updated);
      }
    } else if (calibrationMode === 'perspective') {
      const pts = localPoints || telemetry?.perspective_points;
      if (!pts || pts.length !== 4) return;
      for (let i = 0; i < 4; i++) {
        if (Math.hypot(nx - pts[i][0], ny - pts[i][1]) < 0.08) { setActiveHandle(`p${i}`); break; }
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
      if (!isNaN(idx) && idx >= 0 && idx < 4) { pts[idx] = [nx, ny]; setLocalPoints(pts); }
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
    setLocalLine(updated); updateCountingLine(updated.start, updated.end); wsService.send('set_counting_line', updated);
  };

  // ── Canvas overlay drawing ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (calibrationMode === 'line') {
      const line = localLine || telemetry?.counting_line;
      if (!line) return;
      const sx = line.start[0]*w, sy = line.start[1]*h, ex = line.end[0]*w, ey = line.end[1]*h;
      const mx = (sx+ex)/2, my = (sy+ey)/2;
      const dx = ex-sx, dy = ey-sy, len = Math.hypot(dx,dy)||1;
      const nx = -dy/len, ny = dx/len, arrowDist = 55;
      const inX = mx+nx*arrowDist, inY = my+ny*arrowDist;
      const outX = mx-nx*arrowDist, outY = my-ny*arrowDist;
      // IN arrow
      ctx.strokeStyle='#10B981'; ctx.fillStyle='#10B981'; ctx.lineWidth=3.5;
      ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(inX,inY); ctx.stroke();
      ctx.font='bold 13px Inter,sans-serif'; ctx.fillStyle='#06281E';
      ctx.fillRect(inX-95,inY-14,190,28); ctx.strokeStyle='#10B981'; ctx.lineWidth=2; ctx.strokeRect(inX-95,inY-14,190,28);
      ctx.fillStyle='#10B981'; ctx.textAlign='center'; ctx.fillText('▲ IN (ENTERING / INSIDE)',inX,inY+5);
      // OUT arrow
      ctx.strokeStyle='#F43F5E'; ctx.fillStyle='#F43F5E'; ctx.lineWidth=3.5;
      ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(outX,outY); ctx.stroke();
      ctx.fillStyle='#2D0A14'; ctx.fillRect(outX-95,outY-14,190,28);
      ctx.strokeStyle='#F43F5E'; ctx.lineWidth=2; ctx.strokeRect(outX-95,outY-14,190,28);
      ctx.fillStyle='#F43F5E'; ctx.fillText('▼ OUT (EXITING / OUTSIDE)',outX,outY+5); ctx.textAlign='left';
      // Line
      ctx.strokeStyle='rgba(0,240,255,0.4)'; ctx.lineWidth=8; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.strokeStyle='#00F0FF'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
      // Handles
      [[sx,sy,'A'],[ex,ey,'B']].forEach(([px,py,lbl],i) => {
        ctx.fillStyle='#00F0FF'; ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(px,py,14,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#070B13'; ctx.font='bold 12px JetBrains Mono,monospace'; ctx.fillText(lbl,px-4,py+4);
        ctx.fillStyle='#00F0FF'; ctx.font='bold 11px JetBrains Mono,monospace';
        ctx.fillText(`Point ${lbl} (${i===0?'Start':'End'})`,px+18,py+4);
      });
      ctx.fillStyle='rgba(7,10,17,0.92)'; ctx.fillRect(20,h-45,620,32);
      ctx.strokeStyle='#00F0FF'; ctx.lineWidth=1.5; ctx.strokeRect(20,h-45,620,32);
      ctx.fillStyle='#00F0FF'; ctx.font='bold 11px JetBrains Mono,monospace';
      ctx.fillText('⚡ LINE EDITING: DRAG POINT A & B • APPLIES INSTANTLY • CLICK DONE TO SAVE',30,h-25);
    } else if (calibrationMode === 'perspective') {
      const pts = localPoints || telemetry?.perspective_points;
      if (!pts || pts.length !== 4) return;
      const pxPts = pts.map(p => [p[0]*w, p[1]*h]);
      ctx.fillStyle='rgba(0,240,255,0.18)'; ctx.beginPath();
      ctx.moveTo(pxPts[0][0],pxPts[0][1]); ctx.lineTo(pxPts[1][0],pxPts[1][1]);
      ctx.lineTo(pxPts[2][0],pxPts[2][1]); ctx.lineTo(pxPts[3][0],pxPts[3][1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(0,240,255,0.4)'; ctx.lineWidth=1.5;
      [0.25,0.5,0.75].forEach(f => {
        const tx=pxPts[0][0]+(pxPts[1][0]-pxPts[0][0])*f, ty=pxPts[0][1]+(pxPts[1][1]-pxPts[0][1])*f;
        const bx=pxPts[3][0]+(pxPts[2][0]-pxPts[3][0])*f, by=pxPts[3][1]+(pxPts[2][1]-pxPts[3][1])*f;
        ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(bx,by); ctx.stroke();
        const lx=pxPts[0][0]+(pxPts[3][0]-pxPts[0][0])*f, ly=pxPts[0][1]+(pxPts[3][1]-pxPts[0][1])*f;
        const rx=pxPts[1][0]+(pxPts[2][0]-pxPts[1][0])*f, ry=pxPts[1][1]+(pxPts[2][1]-pxPts[1][1])*f;
        ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(rx,ry); ctx.stroke();
      });
      ctx.strokeStyle='#00F0FF'; ctx.lineWidth=3;
      ctx.beginPath(); pxPts.forEach((p,i)=>i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1])); ctx.closePath(); ctx.stroke();
      ['① TL','② TR','③ BR','④ BL'].forEach((lbl,i) => {
        const [px,py] = pxPts[i];
        ctx.strokeStyle='#10B981'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(px,py,18,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle='#10B981'; ctx.beginPath(); ctx.arc(px,py,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2); ctx.fill();
        ctx.font='bold 11px JetBrains Mono,monospace'; ctx.fillStyle='rgba(7,10,17,0.92)';
        ctx.fillRect(px+20,py-13,150,24); ctx.strokeStyle='#10B981'; ctx.lineWidth=1.5; ctx.strokeRect(px+20,py-13,150,24);
        ctx.fillStyle='#10B981'; ctx.fillText(lbl,px+26,py+4);
      });
      ctx.fillStyle='rgba(7,10,17,0.92)'; ctx.fillRect(20,h-45,680,32);
      ctx.strokeStyle='#10B981'; ctx.lineWidth=1.5; ctx.strokeRect(20,h-45,680,32);
      ctx.fillStyle='#10B981'; ctx.font='bold 11px JetBrains Mono,monospace';
      ctx.fillText('⚡ 4-PT CALIBRATION: DRAG ANY CORNER (TL,TR,BR,BL) • APPLIES INSTANTLY • CLICK DONE TO SAVE',30,h-25);
    }
  }, [calibrationMode, localLine, localPoints, telemetry]);

  const sourceName = isDeviceCameraActive
    ? `Device Cam (${facingMode === 'environment' ? 'Rear' : 'Front'})`
    : (telemetry?.source?.source_type || 'Facility Stream');
  const isPrivacyActive = telemetry?.privacy?.enabled;
  const resParts = (telemetry?.resolution || '1280x720').split('x');
  const canvasWidth = parseInt(resParts[0]) || 1280;
  const canvasHeight = parseInt(resParts[1]) || 720;

  return (
    <div className="glass-panel video-panel" ref={containerRef}>
      <div className="video-container">
        {/* Hidden offscreen video + canvas for phone camera frame capture */}
        <video ref={videoDeviceRef} autoPlay playsInline muted
          style={{ display: 'none', position: 'absolute', width: 1, height: 1, opacity: 0 }} />
        <canvas ref={offscreenCanvasRef} style={{ display: 'none' }} />

        {/* ── Main MJPEG stream from backend ── */}
        <img
          ref={imgRef}
          src={getStreamSrc()}
          alt="VisionEye Live AI Stream"
          className="video-element"
          onLoad={() => {
            setStreamErrorCount(0);
            setStreamStatus('live');
            if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
          }}
          onError={(e) => {
            const count = streamErrorCount + 1;
            setStreamErrorCount(count);
            if (count > 3) setStreamStatus('error');
            logError('Stream', `MJPEG feed error #${count}`, e.type);
            // Retry with backoff
            const delay = Math.min(500 * count, 3000);
            setTimeout(() => {
              if (imgRef.current) imgRef.current.src = getStreamSrc();
            }, delay);
          }}
        />

        {/* ── Loading spinner (shows only while status === 'loading') ── */}
        {streamStatus === 'loading' && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(6,9,19,0.7)',
            backdropFilter:'blur(4px)', display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:'0.75rem', zIndex:15, pointerEvents:'none'
          }}>
            <RefreshCw size={28} style={{ color:'var(--accent-cyan)', animation:'spin 1.2s linear infinite' }} />
            <span style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--accent-cyan)', fontFamily:'var(--font-mono)' }}>
              ⚡ LOADING VIDEO STREAM...
            </span>
          </div>
        )}

        {/* ── Stream error state ── */}
        {streamStatus === 'error' && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(6,9,19,0.85)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            gap:'0.75rem', zIndex:15
          }}>
            <AlertCircle size={36} style={{ color:'var(--accent-rose)' }} />
            <span style={{ color:'var(--accent-rose)', fontWeight:700, fontFamily:'var(--font-mono)', fontSize:'0.9rem' }}>
              STREAM UNAVAILABLE
            </span>
            <span style={{ color:'var(--text-muted)', fontSize:'0.78rem', textAlign:'center', maxWidth:'260px' }}>
              Backend video pipeline may have stopped. Try selecting a source below.
            </span>
            <button
              onClick={reloadStream}
              className="btn btn-primary"
              style={{ padding:'0.5rem 1.25rem', fontSize:'0.82rem', marginTop:'0.5rem' }}
            >
              <RefreshCw size={13} style={{ marginRight:'0.4rem' }} />
              Retry Stream
            </button>
          </div>
        )}

        {/* ── Camera permission error banner ── */}
        {cameraError && (
          <div style={{
            position:'absolute', top:'55px', left:'12px', right:'12px',
            background:'rgba(244,63,94,0.95)', color:'#FFF',
            padding:'0.7rem 1rem', borderRadius:'8px', fontSize:'0.81rem',
            display:'flex', alignItems:'flex-start', justifyContent:'space-between',
            gap:'0.75rem', zIndex:25, boxShadow:'0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <span>⚠️ {cameraError}</span>
            <button onClick={() => setCameraError('')} style={{
              background:'rgba(255,255,255,0.2)', border:'none', color:'#FFF',
              borderRadius:'4px', padding:'0.2rem 0.5rem', cursor:'pointer', fontSize:'0.75rem', flexShrink:0
            }}>✕</button>
          </div>
        )}

        {/* ── Error log panel ── */}
        {showErrorLog && (
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            background:'rgba(4,6,14,0.97)', borderTop:'1px solid rgba(244,63,94,0.5)',
            maxHeight:'220px', overflowY:'auto', zIndex:30, padding:'0.5rem 0.75rem'
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.4rem' }}>
              <span style={{ fontSize:'0.72rem', fontFamily:'var(--font-mono)', color:'var(--accent-rose)', fontWeight:700 }}>
                ⚡ LIVE ERROR LOG ({errorLogs.length})
              </span>
              <div style={{ display:'flex', gap:'0.4rem' }}>
                <button onClick={clearErrors} style={{ fontSize:'0.68rem', background:'rgba(244,63,94,0.2)', border:'1px solid rgba(244,63,94,0.4)', color:'#F43F5E', borderRadius:'4px', padding:'0.15rem 0.5rem', cursor:'pointer' }}>Clear</button>
                <button onClick={() => setShowErrorLog(false)} style={{ fontSize:'0.68rem', background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={12} /></button>
              </div>
            </div>
            {errorLogs.length === 0 && (
              <div style={{ fontSize:'0.72rem', color:'var(--text-dim)', fontFamily:'var(--font-mono)' }}>No errors logged ✓</div>
            )}
            {errorLogs.map(entry => (
              <div key={entry.id} style={{ fontSize:'0.7rem', fontFamily:'var(--font-mono)', color:'#FCD34D', marginBottom:'0.25rem', lineHeight:1.4 }}>
                <span style={{ color:'var(--text-dim)' }}>[{entry.time}] </span>
                <span style={{ color:'var(--accent-rose)' }}>[{entry.source}] </span>
                {entry.msg}
                {entry.detail && <span style={{ color:'var(--text-dim)' }}> — {entry.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {/* ── Interactive overlay canvas ── */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="canvas-overlay"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />

        {/* ── Top HUD bar ── */}
        <div className="video-hud-top">
          <div style={{ display:'flex', gap:'0.5rem', pointerEvents:'auto', alignItems:'center', flexWrap:'wrap' }}>
            <div className="hud-tag" style={{ borderLeft:'3px solid var(--accent-cyan)' }}>
              <Camera size={13} style={{ color:'var(--accent-cyan)' }} />
              <span style={{ textTransform:'uppercase' }}>{sourceName}</span>
            </div>

            {isDeviceCameraActive && (
              <div style={{ display:'flex', gap:'0.35rem' }}>
                <button
                  onClick={handleToggleFacingMode}
                  className="btn btn-secondary"
                  style={{ padding:'0.25rem 0.55rem', fontSize:'0.72rem', display:'inline-flex', alignItems:'center', gap:'0.3rem', background:'rgba(0,240,255,0.15)', borderColor:'var(--accent-cyan)' }}
                  title="Switch Front / Rear Camera"
                >
                  <SwitchCamera size={12} style={{ color:'var(--accent-cyan)' }} />
                  <span>Flip ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
                </button>
                <button
                  onClick={stopDeviceCamera}
                  className="btn btn-secondary"
                  style={{ padding:'0.25rem 0.55rem', fontSize:'0.72rem', background:'rgba(244,63,94,0.15)', borderColor:'var(--accent-rose)' }}
                  title="Stop Camera"
                >✕ Stop</button>
              </div>
            )}

            {isPrivacyActive && (
              <div className="hud-tag" style={{ borderLeft:'3px solid var(--accent-rose)', color:'var(--accent-rose)' }}>
                <Shield size={13} />
                <span>PRIVACY: {telemetry?.privacy?.mode?.toUpperCase()}</span>
              </div>
            )}

            {/* Error log toggle button */}
            <button
              onClick={() => setShowErrorLog(v => !v)}
              className="btn btn-secondary"
              style={{
                padding:'0.22rem 0.5rem', fontSize:'0.68rem', display:'inline-flex', alignItems:'center', gap:'0.25rem',
                background: errorLogs.length > 0 ? 'rgba(244,63,94,0.15)' : 'transparent',
                borderColor: errorLogs.length > 0 ? 'var(--accent-rose)' : 'rgba(255,255,255,0.15)',
                color: errorLogs.length > 0 ? '#F43F5E' : 'var(--text-dim)',
              }}
              title="Toggle Error Log"
            >
              <AlertCircle size={11} />
              <span>{errorLogs.length > 0 ? `${errorLogs.length} Log${errorLogs.length > 1 ? 's' : ''}` : 'Log'}</span>
            </button>
          </div>

          {/* Live IN / OUT / Inside counts on HUD */}
          <div style={{ display:'flex', gap:'0.4rem', pointerEvents:'auto' }}>
            <div className="hud-tag" style={{ borderLeft:'3px solid var(--accent-emerald)', color:'#10B981', fontWeight:700 }}>
              <span>IN: {telemetry?.total_in ?? 0}</span>
            </div>
            <div className="hud-tag" style={{ borderLeft:'3px solid var(--accent-rose)', color:'#F43F5E', fontWeight:700 }}>
              <span>OUT: {telemetry?.total_out ?? 0}</span>
            </div>
            <div className="hud-tag" style={{ borderLeft:'3px solid var(--accent-cyan)', color:'#00F0FF', fontWeight:700 }}>
              <span>INSIDE: {telemetry?.occupancy ?? 0}</span>
            </div>
          </div>

          <div style={{ display:'flex', gap:'0.5rem', pointerEvents:'auto' }}>
            {calibrationMode ? (
              <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                {calibrationMode === 'line' && (
                  <button onClick={handleFlipLine} className="btn btn-secondary"
                    style={{ padding:'0.35rem 0.65rem', fontSize:'0.74rem' }} title="Swap IN/OUT">
                    <RefreshCw size={12} /><span>Flip IN/OUT</span>
                  </button>
                )}
                {calibrationMode === 'perspective' && (
                  <button onClick={async () => { await autoCalibrateFloor(); wsService.send('auto_calibrate'); }}
                    className="btn btn-secondary"
                    style={{ padding:'0.35rem 0.65rem', fontSize:'0.74rem', color:'var(--accent-cyan)', borderColor:'rgba(0,240,255,0.4)' }}
                    title="1-Click Auto Calibrate">
                    <Zap size={12} style={{ color:'var(--accent-cyan)' }} /><span>⚡ Auto-Cal</span>
                  </button>
                )}
                <button onClick={() => onSetCalibrationMode(null)} className="btn btn-primary"
                  style={{ padding:'0.35rem 0.85rem', fontSize:'0.76rem', fontWeight:700, background:'#10B981', color:'#06281E', border:'1px solid #10B981', boxShadow:'0 0 14px rgba(16,185,129,0.5)' }}>
                  <CheckCircle2 size={13} /><span>✓ Done</span>
                </button>
              </div>
            ) : (
              <div className="hud-tag" style={{ color:'var(--accent-emerald)' }}>
                <span className="pulse-dot" /><span>LIVE CV PIPELINE</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
