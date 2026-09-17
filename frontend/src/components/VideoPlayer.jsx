import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  memo,
} from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  SwitchCamera,
  AlertCircle,
  Play,
} from 'lucide-react';
import {
  updateCountingLine,
  updatePerspective,
  pushClientFrame,
} from '../services/api';
import { wsService } from '../services/websocket';

// ─── Simple global error logger ──────────────────────────────────────────────
const _errorLogs = [];
const _errorListeners = new Set();

export function logError(source, msg, detail) {
  const entry = {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString(),
    source,
    msg: String(msg),
    detail: detail ? String(detail) : '',
  };
  _errorLogs.unshift(entry);
  if (_errorLogs.length > 30) _errorLogs.pop();
  _errorListeners.forEach((fn) => fn([..._errorLogs]));
}

export function useErrorLog() {
  const [logs, setLogs] = useState([..._errorLogs]);
  useEffect(() => {
    _errorListeners.add(setLogs);
    return () => _errorListeners.delete(setLogs);
  }, []);
  return [
    logs,
    () => {
      _errorLogs.length = 0;
      _errorListeners.forEach((fn) => fn([]));
    },
  ];
}

// ─── Stream URL helper ────────────────────────────────────────────────────────
function getStreamSrc() {
  const ts = Date.now();
  const base =
    window.location.port === '5173'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : '';
  return `${base}/api/video/feed?t=${ts}`;
}

// ─── Safe cross-platform play() ───────────────────────────────────────────────
// Returns: 'playing' | 'blocked' | 'error'
async function safePlay(videoEl) {
  if (!videoEl) return 'error';
  try {
    const promise = videoEl.play();
    if (promise !== undefined) await promise;
    return 'playing';
  } catch (err) {
    if (
      err.name === 'NotAllowedError' ||
      err.name === 'AbortError'
    ) {
      // Autoplay blocked (common on iOS/Android/Chrome without user gesture)
      return 'blocked';
    }
    // NotSupportedError or other — still return blocked so UI shows play button
    console.warn('[VideoPlayer] play() error:', err.name, err.message);
    return 'blocked';
  }
}

// ─── Stable HUD metrics (updated via DOM, not React state) ───────────────────
const MetricsHUD = memo(function MetricsHUD({ telemetry, isLocalMode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.4rem',
        pointerEvents: 'none',
      }}
    >
      <div
        className="hud-tag"
        style={{
          background: 'rgba(16,185,129,0.2)',
          border: '1px solid #10B981',
          color: '#10B981',
          fontWeight: 700,
        }}
      >
        IN: {telemetry?.total_in ?? 0}
      </div>
      <div
        className="hud-tag"
        style={{
          background: 'rgba(244,63,94,0.2)',
          border: '1px solid #F43F5E',
          color: '#F43F5E',
          fontWeight: 700,
        }}
      >
        OUT: {telemetry?.total_out ?? 0}
      </div>
      <div
        className="hud-tag"
        style={{
          background: 'rgba(0,240,255,0.2)',
          border: '1px solid #00F0FF',
          color: '#00F0FF',
          fontWeight: 700,
        }}
      >
        INSIDE: {telemetry?.occupancy ?? 0}
      </div>
      {isLocalMode && (
        <div
          className="hud-tag"
          style={{
            background: 'rgba(245,158,11,0.2)',
            border: '1px solid #F59E0B',
            color: '#F59E0B',
            fontSize: '0.68rem',
          }}
        >
          ⚡ Local Preview
        </div>
      )}
    </div>
  );
});

// ─── Main VideoPlayer ─────────────────────────────────────────────────────────
export default function VideoPlayer({
  telemetry,
  calibrationMode,
  onSetCalibrationMode,
}) {
  // ── Refs (never in state — no re-renders from these) ──────────────────────
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // The stable local <video> element for uploaded file preview
  const localVideoRef = useRef(null);

  // The MJPEG <img> element for live backend stream
  const mjpegImgRef = useRef(null);

  // For device (webcam) capture
  const deviceVideoRef = useRef(null);
  const offscreenCanvasRef = useRef(null);

  // Object URL management — tracked in ref, not state
  const objectUrlRef = useRef(null);

  // MJPEG reconnect timer
  const mjpegRetryRef = useRef(null);
  const mjpegRetryCountRef = useRef(0);

  // ── React state (only what actually needs to trigger UI changes) ──────────
  const [displayMode, setDisplayMode] = useState('stream'); // 'stream' | 'local' | 'device'
  const [playBlocked, setPlayBlocked] = useState(false);    // autoplay blocked → show play button
  const [streamError, setStreamError] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isDeviceCameraActive, setIsDeviceCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [sourceName, setSourceName] = useState('Live Stream');

  // Calibration overlay state
  const [activeHandle, setActiveHandle] = useState(null);
  const [localLine, setLocalLine] = useState(null);
  const [localPoints, setLocalPoints] = useState(null);

  // ── Sync calibration data from telemetry ─────────────────────────────────
  useEffect(() => {
    if (telemetry?.counting_line && !localLine)
      setLocalLine(telemetry.counting_line);
    if (telemetry?.perspective_points && !localPoints)
      setLocalPoints(telemetry.perspective_points);
  }, [telemetry]);

  // ── Update source name display from telemetry ─────────────────────────────
  useEffect(() => {
    if (isDeviceCameraActive) {
      setSourceName(
        `Camera (${facingMode === 'user' ? 'Front' : 'Rear'})`
      );
    } else if (telemetry?.source?.source_type === 'file') {
      const name =
        telemetry.source.source_path?.split('/').pop() || 'Uploaded Video';
      setSourceName(`File: ${name}`);
    } else if (telemetry?.source?.source_type === 'synthetic') {
      setSourceName('Demo Stream');
    } else {
      setSourceName('Live Stream');
    }
  }, [telemetry, isDeviceCameraActive, facingMode]);

  // ── Object URL helpers ────────────────────────────────────────────────────
  const revokeCurrentObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // ── Local video: attach file and play immediately ─────────────────────────
  const playLocalFile = useCallback(
    async (file) => {
      const vid = localVideoRef.current;
      if (!vid) return;

      // Revoke old URL first (only now, not before)
      revokeCurrentObjectUrl();

      // Create fresh object URL
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;

      setSourceName(`${file.name}`);
      setPlayBlocked(false);
      setDisplayMode('local');

      // Reset video element cleanly
      vid.pause();
      vid.removeAttribute('src');
      vid.load(); // Reset internal state

      // Attach URL and configure for all platforms
      vid.src = url;
      vid.muted = true;   // Required for autoplay on all platforms
      vid.loop = true;
      vid.playsInline = true; // Critical for iOS
      vid.controls = false;

      // Wait for enough data to play (cross-platform safe)
      await new Promise((resolve) => {
        const onCanPlay = () => {
          vid.removeEventListener('canplay', onCanPlay);
          vid.removeEventListener('error', onCanPlay);
          resolve();
        };
        vid.addEventListener('canplay', onCanPlay, { once: true });
        vid.addEventListener('error', onCanPlay, { once: true });
        // Kick load
        vid.load();
      });

      const result = await safePlay(vid);
      if (result === 'blocked') {
        setPlayBlocked(true);
      } else {
        setPlayBlocked(false);
      }

      logError('VideoPlayer', `Local preview started: ${file.name}`, '');
    },
    [revokeCurrentObjectUrl]
  );

  // ── MJPEG stream management ───────────────────────────────────────────────
  const clearMjpegRetry = useCallback(() => {
    if (mjpegRetryRef.current) {
      clearTimeout(mjpegRetryRef.current);
      mjpegRetryRef.current = null;
    }
  }, []);

  const lastConnectTimeRef = useRef(0);
  const connectMjpegStream = useCallback(() => {
    const now = Date.now();
    if (now - lastConnectTimeRef.current < 1000) {
      return;
    }
    lastConnectTimeRef.current = now;
    const img = mjpegImgRef.current;
    if (!img) return;
    clearMjpegRetry();
    setStreamError(false);
    img.src = getStreamSrc();
  }, [clearMjpegRetry]);

  const scheduleMjpegRetry = useCallback(() => {
    clearMjpegRetry();
    const count = mjpegRetryCountRef.current;
    // Exponential backoff: 1s, 2s, 4s, 8s, max 15s
    const delay = Math.min(1000 * Math.pow(2, count), 15000);
    mjpegRetryCountRef.current += 1;
    mjpegRetryRef.current = setTimeout(() => {
      connectMjpegStream();
    }, delay);
  }, [clearMjpegRetry, connectMjpegStream]);

  const reloadStream = useCallback(() => {
    mjpegRetryCountRef.current = 0;
    connectMjpegStream();
  }, [connectMjpegStream]);

  // Reset retry counter on success
  const handleStreamLoad = useCallback(() => {
    mjpegRetryCountRef.current = 0;
    setStreamError(false);
  }, []);

  const handleStreamError = useCallback(() => {
    setStreamError(true);
    scheduleMjpegRetry();
  }, [scheduleMjpegRetry]);

  // ── Switch back to stream mode (when backend is ready) ───────────────────
  const switchToStream = useCallback(() => {
    setDisplayMode('stream');
    reloadStream();
  }, [reloadStream]);

  // ── Custom event listeners ────────────────────────────────────────────────
  useEffect(() => {
    // visioneye:video_selected — fired by ControlsPanel with the File immediately
    const handleVideoSelected = async (e) => {
      const { file } = e.detail || {};
      if (!file) return;
      setIsDeviceCameraActive(false);
      stopDeviceCamera();
      await playLocalFile(file);
    };

    // visioneye:stream_reload — fired after backend confirms source is ready
    const handleStreamReload = () => {
      // If we're in local mode, don't immediately switch — wait a bit for backend
      // If already in stream mode, just reload
      if (displayMode === 'stream') {
        reloadStream();
      }
      // In local mode, we switch after backend has had time to start
      // (controlled by ControlsPanel which fires this after upload resolves)
    };

    // visioneye:stream_ready — fires when upload+backend processing confirmed
    const handleStreamReady = () => {
      switchToStream();
    };

    // visioneye:device_camera_toggle
    const handleCameraToggle = (e) => {
      if (e.detail?.active) startDeviceCamera();
      else stopDeviceCamera();
    };

    window.addEventListener('visioneye:video_selected', handleVideoSelected);
    window.addEventListener('visioneye:stream_reload', handleStreamReload);
    window.addEventListener('visioneye:stream_ready', handleStreamReady);
    window.addEventListener('visioneye:device_camera_toggle', handleCameraToggle);

    return () => {
      window.removeEventListener('visioneye:video_selected', handleVideoSelected);
      window.removeEventListener('visioneye:stream_reload', handleStreamReload);
      window.removeEventListener('visioneye:stream_ready', handleStreamReady);
      window.removeEventListener('visioneye:device_camera_toggle', handleCameraToggle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode, playLocalFile, reloadStream, switchToStream]);

  // ── Telemetry source change → reload stream only on actual source change ──
  const prevSourceRef = useRef(null);
  useEffect(() => {
    const sType = telemetry?.source?.source_type;
    const sPath = telemetry?.source?.source_path;
    if (!sType) return;
    const current = `${sType}|${sPath || ''}`;
    if (prevSourceRef.current && prevSourceRef.current !== current && displayMode === 'stream') {
      reloadStream();
    }
    prevSourceRef.current = current;
  }, [telemetry?.source?.source_type, telemetry?.source?.source_path, displayMode, reloadStream]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      revokeCurrentObjectUrl();
      clearMjpegRetry();
      stopDeviceCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initial stream connect ────────────────────────────────────────────────
  useEffect(() => {
    connectMjpegStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Device Camera ─────────────────────────────────────────────────────────
  const startDeviceCamera = async (overrideFacing) => {
    setCameraError('');
    const targetFacing = overrideFacing || facingMode;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera requires HTTPS or localhost.');
      }
      stopDeviceCamera();

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetFacing ? { ideal: targetFacing } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch {
        // Fallback: no facingMode constraint (works on all webcams)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      const vid = deviceVideoRef.current;
      if (vid) {
        vid.srcObject = stream;
        vid.muted = true;
        vid.playsInline = true;
        const result = await safePlay(vid);
        if (result === 'blocked') {
          logError('Camera', 'Camera autoplay blocked', '');
        }
      }

      setDisplayMode('device');
      setIsDeviceCameraActive(true);
    } catch (err) {
      const isPermission =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isPermission
        ? 'Camera permission denied. Please allow camera access.'
        : `Camera unavailable: ${err.message || 'No camera found.'}`;
      setCameraError(msg);
      logError('Camera', msg, err.name);
      setIsDeviceCameraActive(false);
    }
  };

  const stopDeviceCamera = () => {
    const vid = deviceVideoRef.current;
    if (vid?.srcObject) {
      try {
        vid.srcObject.getTracks().forEach((t) => t.stop());
      } catch {}
      vid.srcObject = null;
    }
    setIsDeviceCameraActive(false);
  };

  const handleToggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startDeviceCamera(next);
  };

  // ── Frame push loop (Device Camera → AI Backend) ──────────────────────────
  useEffect(() => {
    if (!isDeviceCameraActive) return;
    let busy = false;
    const iv = setInterval(() => {
      if (busy || !deviceVideoRef.current || !offscreenCanvasRef.current)
        return;
      const vid = deviceVideoRef.current;
      if (vid.readyState < 2 || vid.videoWidth === 0) return;
      const canvas = offscreenCanvasRef.current;
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(vid, 0, 0, 640, 480);
      const b64 = canvas.toDataURL('image/jpeg', 0.65);
      busy = true;
      pushClientFrame(b64)
        .catch((e) => logError('FramePush', 'Frame push error', e.message))
        .finally(() => {
          busy = false;
        });
    }, 66); // ~15 FPS
    return () => clearInterval(iv);
  }, [isDeviceCameraActive]);

  // ── Manual play button (when autoplay is blocked) ─────────────────────────
  const handleManualPlay = async () => {
    const vid = localVideoRef.current;
    if (!vid) return;
    const result = await safePlay(vid);
    if (result === 'playing') setPlayBlocked(false);
  };

  // ── Canvas calibration overlay ────────────────────────────────────────────
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
        const dx = line.end[0] - line.start[0];
        const dy = line.end[1] - line.start[1];
        const updated = {
          start: [
            Math.max(0, Math.min(1, nx - dx / 2)),
            Math.max(0, Math.min(1, ny - dy / 2)),
          ],
          end: [
            Math.max(0, Math.min(1, nx + dx / 2)),
            Math.max(0, Math.min(1, ny + dy / 2)),
          ],
        };
        setLocalLine(updated);
        updateCountingLine(updated.start, updated.end);
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
      if (activeHandle === 'line_start')
        setLocalLine({ ...line, start: [nx, ny] });
      else if (activeHandle === 'line_end')
        setLocalLine({ ...line, end: [nx, ny] });
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

  // ── Canvas overlay drawing ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw Counting Line whenever active or in calibration mode
    if (calibrationMode === 'line' || displayMode === 'local') {
      const line = localLine || telemetry?.counting_line || { start: [0.1, 0.5], end: [0.9, 0.5] };
      if (line) {
        const sx = line.start[0] * w,
          sy = line.start[1] * h,
          ex = line.end[0] * w,
          ey = line.end[1] * h;
        const mx = (sx + ex) / 2,
          my = (sy + ey) / 2;
        const dx = ex - sx,
          dy = ey - sy,
          len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len,
          ny = dx / len,
          arrowDist = 45;
        const inX = mx + nx * arrowDist,
          inY = my + ny * arrowDist;
        const outX = mx - nx * arrowDist,
          outY = my - ny * arrowDist;

        // IN direction arrow & badge
        ctx.strokeStyle = '#10B981';
        ctx.fillStyle = '#10B981';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(inX, inY);
        ctx.stroke();
        ctx.font = 'bold 11px Inter,sans-serif';
        ctx.fillStyle = '#06281E';
        ctx.fillRect(inX - 70, inY - 11, 140, 22);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(inX - 70, inY - 11, 140, 22);
        ctx.fillStyle = '#10B981';
        ctx.textAlign = 'center';
        ctx.fillText('▲ IN (ENTERING)', inX, inY + 4);

        // OUT direction arrow & badge
        ctx.strokeStyle = '#F43F5E';
        ctx.fillStyle = '#F43F5E';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(outX, outY);
        ctx.stroke();
        ctx.fillStyle = '#2D0A14';
        ctx.fillRect(outX - 70, outY - 11, 140, 22);
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(outX - 70, outY - 11, 140, 22);
        ctx.fillStyle = '#F43F5E';
        ctx.fillText('▼ OUT (EXITING)', outX, outY + 4);
        ctx.textAlign = 'left';

        // Main Virtual Counting Line
        ctx.strokeStyle = 'rgba(0,240,255,0.35)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // End Handle Markers (A and B)
        const isEditing = calibrationMode === 'line';
        [
          [sx, sy, 'A'],
          [ex, ey, 'B'],
        ].forEach(([px, py, lbl]) => {
          ctx.fillStyle = isEditing ? '#00F0FF' : 'rgba(0,240,255,0.85)';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = isEditing ? 3 : 2;
          ctx.beginPath();
          ctx.arc(px, py, isEditing ? 14 : 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#070B13';
          ctx.font = `bold ${isEditing ? '11px' : '9px'} JetBrains Mono,monospace`;
          ctx.fillText(lbl, px - 3.5, py + 3.5);
        });
      }
    }

    if (calibrationMode === 'perspective') {
      const pts = localPoints || telemetry?.perspective_points;
      if (!pts || pts.length !== 4) return;
      const pxPts = pts.map((p) => [p[0] * w, p[1] * h]);
      ctx.fillStyle = 'rgba(0,240,255,0.15)';
      ctx.beginPath();
      ctx.moveTo(pxPts[0][0], pxPts[0][1]);
      pxPts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      pxPts.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])
      );
      ctx.closePath();
      ctx.stroke();
      ['① TL', '② TR', '③ BR', '④ BL'].forEach((lbl, i) => {
        const [px, py] = pxPts[i];
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 11px JetBrains Mono,monospace';
        ctx.fillStyle = 'rgba(7,10,17,0.9)';
        ctx.fillRect(px + 14, py - 10, 80, 20);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 14, py - 10, 80, 20);
        ctx.fillStyle = '#10B981';
        ctx.fillText(lbl, px + 18, py + 4);
      });
    }
  }, [calibrationMode, displayMode, localLine, localPoints, telemetry]);

  // ── Canvas size from telemetry resolution ─────────────────────────────────
  const resParts = (telemetry?.resolution || '1280x720').split('x');
  const canvasWidth = parseInt(resParts[0]) || 1280;
  const canvasHeight = parseInt(resParts[1]) || 720;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="glass-panel video-panel"
      ref={containerRef}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <div
        className="video-container"
        style={{
          position: 'relative',
          background: '#030712',
          borderRadius: '12px',
          minHeight: '380px',
          // GPU compositing layer — prevents CPU-bound render freeze on macOS/iOS
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          willChange: 'transform',
        }}
      >
        {/* ── Hidden device camera video element ── */}
        <video
          ref={deviceVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            display: displayMode === 'device' ? 'block' : 'none',
            width: '100%',
            height: 'auto',
            borderRadius: '12px',
          }}
        />

        {/* ── Local file preview <video> — stable, never recreated ── */}
        <video
          ref={localVideoRef}
          playsInline
          muted
          loop
          style={{
            display: displayMode === 'local' ? 'block' : 'none',
            width: '100%',
            height: 'auto',
            borderRadius: '12px',
            // Force hardware decoding on all platforms
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
          }}
          // These must be attributes (not just props) for Safari/iOS
          webkit-playsinline="true"
          x5-playsinline="true"
        />

        {/* ── MJPEG backend stream <img> — stable, only src changes ── */}
        <img
          ref={mjpegImgRef}
          alt="VisionEye AI Stream"
          className="video-element"
          style={{
            display: displayMode === 'stream' ? 'block' : 'none',
            width: '100%',
            height: 'auto',
            borderRadius: '12px',
          }}
          onLoad={handleStreamLoad}
          onError={handleStreamError}
        />

        {/* Hidden offscreen canvas for device camera frame extraction */}
        <canvas ref={offscreenCanvasRef} style={{ display: 'none' }} />

        {/* ── Autoplay blocked: show simple ▶ Play button ── */}
        {playBlocked && displayMode === 'local' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(3,7,18,0.55)',
              zIndex: 15,
              borderRadius: '12px',
            }}
          >
            <button
              onClick={handleManualPlay}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: 'rgba(0,240,255,0.15)',
                border: '2px solid #00F0FF',
                color: '#00F0FF',
                borderRadius: '50px',
                padding: '0.85rem 2rem',
                fontSize: '1.1rem',
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 30px rgba(0,240,255,0.3)',
              }}
            >
              <Play size={22} />
              Play
            </button>
          </div>
        )}

        {/* ── Stream disconnected banner ── */}
        {streamError && displayMode === 'stream' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(6,9,19,0.88)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              zIndex: 20,
              borderRadius: '12px',
            }}
          >
            <AlertCircle size={32} style={{ color: 'var(--accent-rose)' }} />
            <span style={{ color: '#FFF', fontWeight: 600, fontSize: '0.9rem' }}>
              Reconnecting to stream…
            </span>
            <button
              onClick={reloadStream}
              className="btn btn-primary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
            >
              <RefreshCw size={12} style={{ marginRight: '0.3rem' }} />
              Retry Now
            </button>
          </div>
        )}

        {/* ── Camera permission error ── */}
        {cameraError && (
          <div
            style={{
              position: 'absolute',
              top: '50px',
              left: '10px',
              right: '10px',
              background: 'rgba(244,63,94,0.95)',
              color: '#FFF',
              padding: '0.6rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 25,
            }}
          >
            <span>⚠️ {cameraError}</span>
            <button
              onClick={() => setCameraError('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFF',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Calibration canvas overlay ── */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="canvas-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: calibrationMode ? 'auto' : 'none',
            touchAction: calibrationMode ? 'none' : 'auto',
            cursor: calibrationMode ? 'crosshair' : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />

        {/* ── HUD Top Bar ── */}
        <div
          className="video-hud-top"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            right: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {/* Left: source name + camera flip */}
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              pointerEvents: 'auto',
              alignItems: 'center',
            }}
          >
            <div
              className="hud-tag"
              style={{
                background: 'rgba(7,10,19,0.8)',
                border: '1px solid rgba(0,240,255,0.3)',
                color: '#00F0FF',
              }}
            >
              <Camera size={12} />
              <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sourceName}
              </span>
            </div>

            {isDeviceCameraActive && (
              <button
                onClick={handleToggleFacingMode}
                className="btn btn-secondary"
                style={{
                  padding: '0.22rem 0.5rem',
                  fontSize: '0.7rem',
                  background: 'rgba(0,240,255,0.15)',
                  borderColor: '#00F0FF',
                  pointerEvents: 'auto',
                }}
                title="Switch Front/Rear Camera"
              >
                <SwitchCamera size={11} /> Flip
              </button>
            )}
          </div>

          {/* Right: view mode, line adjust, and metrics */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', pointerEvents: 'auto' }}>
            {/* View Mode Switcher */}
            <button
              onClick={() => {
                if (displayMode === 'stream') {
                  setDisplayMode('local');
                } else {
                  switchToStream();
                }
              }}
              className="btn btn-secondary"
              style={{
                padding: '0.22rem 0.65rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                background: displayMode === 'stream' ? 'rgba(0,240,255,0.18)' : 'rgba(245,158,11,0.18)',
                borderColor: displayMode === 'stream' ? '#00F0FF' : '#F59E0B',
                color: displayMode === 'stream' ? '#00F0FF' : '#F59E0B',
                pointerEvents: 'auto',
              }}
              title="Switch between live YOLO26n AI Detection and Raw Local Video"
            >
              {displayMode === 'stream' ? '🧠 AI Stream' : '⚡ Local Preview'}
            </button>

            {/* Quick Line Adjust Button */}
            <button
              onClick={() => onSetCalibrationMode(calibrationMode === 'line' ? null : 'line')}
              className={`btn ${calibrationMode === 'line' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '0.22rem 0.65rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                pointerEvents: 'auto',
                borderColor: 'var(--accent-cyan)',
                color: calibrationMode === 'line' ? '#000' : 'var(--accent-cyan)',
              }}
              title="Adjust counting line position on screen"
            >
              {calibrationMode === 'line' ? '✓ Save Line' : '📏 Adjust Line'}
            </button>

            {/* Metrics rendered as memo component — won't cause video re-renders */}
            <MetricsHUD
              telemetry={telemetry}
              isLocalMode={displayMode === 'local'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
