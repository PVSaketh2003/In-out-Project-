import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Upload, Camera, Sliders,
  RefreshCw, SlidersHorizontal, Layers, CheckCircle2, Zap, Film,
  ArrowLeftRight, Cpu, UserCheck, UserMinus, Activity
} from 'lucide-react';
import {
  startVideoSource, controlVideo, uploadVideoFile,
  updateConfig, resetAnalytics, resetTracking,
  applyPerspectivePreset, autoCalibrateFloor, updateCountingLine
} from '../services/api';
import { wsService } from '../services/websocket';
import { logError } from './VideoPlayer';

export default function ControlsPanel({
  telemetry,
  calibrationMode,
  onSetCalibrationMode
}) {
  const [sourceType, setSourceType] = useState('synthetic');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [confThreshold, setConfThreshold] = useState(0.40);
  const [privacyMode, setPrivacyMode] = useState('none');
  const [statusMessage, setStatusMessage] = useState('');

  // Sync state from telemetry
  useEffect(() => {
    if (telemetry?.confidence_threshold !== undefined) {
      setConfThreshold(telemetry.confidence_threshold);
    }
    if (telemetry?.privacy) {
      if (telemetry.privacy.enabled) {
        setPrivacyMode(telemetry.privacy.mode || 'blur');
      } else {
        setPrivacyMode('none');
      }
    }
    if (telemetry?.source?.source_type) {
      setSourceType(telemetry.source.source_type);
    }
  }, [telemetry]);

  const showNotification = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3500);
  };

  // Switch video input source
  const handleSelectSource = async (type) => {
    setSourceType(type);
    try {
      if (type === 'device_camera' || type === 'client') {
        window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: true } }));
        await startVideoSource('client');
        showNotification('📹 Camera active! Allow browser camera permissions if prompted.');
        logError('Source', 'Activated laptop/device camera', 'client');
      } else if (type === 'synthetic') {
        window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: false } }));
        await startVideoSource('synthetic');
        showNotification('🎬 Demo Stream active (YOLO26n tracking)');
        logError('Source', 'Switched to synthetic demo stream', '');
      }
      setTimeout(() => window.dispatchEvent(new CustomEvent('visioneye:stream_reload')), 200);
    } catch (err) {
      showNotification(`❌ Error switching source: ${err.message}`);
    }
  };

  // Video Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo =
      file.type?.startsWith('video/') ||
      file.name?.match(/\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|ts|ogg|ogv)$/i) ||
      !file.type;

    if (!isVideo) {
      showNotification('❌ Please choose a video file (MP4, MOV, WebM, AVI, etc.)');
      return;
    }

    // Step 1: Immediately dispatch to VideoPlayer for local preview while uploading
    window.dispatchEvent(new CustomEvent('visioneye:video_selected', { detail: { file } }));
    window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: false } }));
    setSourceType('file');
    setUploading(true);
    setUploadProgress(0);
    showNotification(`⚡ Uploading ${file.name} to YOLO26n AI pipeline...`);

    // Step 2: Upload to backend with real-time percentage progress
    try {
      await uploadVideoFile(file, (pct) => setUploadProgress(pct));
      showNotification(`✓ YOLO26n AI Tracking active for ${file.name}!`);
      // Step 3: Switch to the live AI Detection stream
      window.dispatchEvent(new CustomEvent('visioneye:stream_ready'));
    } catch (err) {
      console.warn('[ControlsPanel] Background upload failed:', err);
      showNotification(`⚠️ Upload error (${err.message}) — continuing local preview`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  // Video Playback Controls
  const handleControl = async (action) => {
    try {
      await controlVideo(action);
      showNotification(`Pipeline ${action}ed`);
    } catch (err) {
      showNotification(`Failed to ${action}`);
    }
  };

  // Reset Counters
  const handleResetAnalytics = async () => {
    await resetAnalytics();
    wsService.send('reset_analytics');
    showNotification('✓ Counters reset to 0');
  };

  // Reset Tracks
  const handleResetTracking = async () => {
    await resetTracking();
    showNotification('✓ Track IDs reset');
  };

  // Swap IN / OUT Line
  const handleFlipLine = () => {
    const line = telemetry?.counting_line;
    if (!line) return;
    const newStart = [...line.end];
    const newEnd = [...line.start];
    updateCountingLine(newStart, newEnd);
    wsService.send('set_counting_line', { start: newStart, end: newEnd });
    showNotification('Swapped IN / OUT Flow Direction');
  };

  // 1-Click Line Nudge (Up, Down, Left, Right by 5%)
  const handleNudgeLine = (direction) => {
    const line = telemetry?.counting_line || { start: [0.1, 0.5], end: [0.9, 0.5] };
    const step = 0.05;
    let dx = 0, dy = 0;
    if (direction === 'up') dy = -step;
    else if (direction === 'down') dy = step;
    else if (direction === 'left') dx = -step;
    else if (direction === 'right') dx = step;

    const clamp = (v) => Math.max(0.02, Math.min(0.98, parseFloat(v.toFixed(3))));
    const newStart = [clamp(line.start[0] + dx), clamp(line.start[1] + dy)];
    const newEnd = [clamp(line.end[0] + dx), clamp(line.end[1] + dy)];

    updateCountingLine(newStart, newEnd);
    wsService.send('set_counting_line', { start: newStart, end: newEnd });
    showNotification(`Nudged line ${direction.toUpperCase()}`);
  };

  const handleResetLineDefault = () => {
    const defaultLine = { start: [0.1, 0.5], end: [0.9, 0.5] };
    updateCountingLine(defaultLine.start, defaultLine.end);
    wsService.send('set_counting_line', defaultLine);
    showNotification('Counting line reset to center');
  };

  // Preset Application
  const handleApplyPreset = async (preset) => {
    try {
      await applyPerspectivePreset(preset);
      showNotification(`Applied preset: ${preset.toUpperCase()}`);
    } catch (err) {
      showNotification(`Failed to apply preset: ${err.message}`);
    }
  };

  // Auto Calibrate Floor
  const handleAutoCalibrate = async () => {
    try {
      await autoCalibrateFloor();
      showNotification('⚡ Auto-calibrated floor geometry (1-click)');
    } catch (err) {
      showNotification(`Auto-calibrate error: ${err.message}`);
    }
  };

  // Confidence Threshold Change
  const handleConfidenceChange = (e) => {
    const val = parseFloat(e.target.value);
    setConfThreshold(val);
    wsService.send('set_confidence', { value: val });
    updateConfig({ confidence_threshold: val }).catch(console.error);
  };

  // Privacy Mode Toggle
  const handlePrivacyChange = async (mode) => {
    const enabled = mode !== 'none';
    setPrivacyMode(mode);
    const modeName = enabled ? mode : 'blur';
    wsService.send('set_privacy', { mode: modeName, enabled });
    await updateConfig({ privacy: { mode: modeName, enabled } });
    showNotification(`Privacy Mode: ${mode.toUpperCase()}`);
  };

  const recentEvents = telemetry?.recent_events || [];

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* Title & Status Message */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
          <SlidersHorizontal size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>VIDEO SOURCE & CONTROLS</span>
        </div>
        {statusMessage ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {statusMessage}
          </span>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Cpu size={12} />
            <span>YOLO26n ONNX</span>
          </span>
        )}
      </div>

      {/* 1. Main 3-Tab Source Switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        <button
          onClick={() => handleSelectSource('synthetic')}
          className={`btn ${sourceType === 'synthetic' ? 'btn-active' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 0.5rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}
        >
          <Film size={18} style={{ color: sourceType === 'synthetic' ? '#000' : 'var(--accent-cyan)' }} />
          <span>Demo Video</span>
        </button>

        <button
          onClick={() => handleSelectSource('device_camera')}
          className={`btn ${sourceType === 'device_camera' || sourceType === 'client' ? 'btn-active' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 0.5rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}
        >
          <Camera size={18} style={{ color: (sourceType === 'device_camera' || sourceType === 'client') ? '#000' : 'var(--accent-emerald)' }} />
          <span>Laptop / Phone Cam</span>
        </button>

        <button
          onClick={() => setSourceType('file')}
          className={`btn ${sourceType === 'file' ? 'btn-active' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 0.5rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}
        >
          <Upload size={18} style={{ color: sourceType === 'file' ? '#000' : 'var(--accent-rose)' }} />
          <span>Upload Video</span>
        </button>
      </div>

      {/* 2. Upload Box / Active Source Details */}
      {sourceType === 'file' && (
        <div style={{
          background: 'rgba(0, 240, 255, 0.04)', border: '1px dashed rgba(0, 240, 255, 0.3)',
          borderRadius: '12px', padding: '1.15rem', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textAlign: 'center'
        }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '0.7rem 1.5rem', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
            <Upload size={16} />
            <span>
              {uploading
                ? `⚡ Uploading to AI: ${uploadProgress}%...`
                : 'Choose Video (MP4, MOV, WebM)'}
            </span>
            <input
              type="file"
              accept="video/*,video/mp4,video/quicktime,video/mov,video/webm,video/x-m4v,video/mkv,video/avi"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Instant playback • Up to 500 MB • Real-time YOLO26n tracking
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('visioneye:stream_ready'))}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}
              title="Switch to live AI Detection stream"
            >
              🧠 Show AI Stream (Boxes & Line)
            </button>
          </div>
        </div>
      )}

      {(sourceType === 'device_camera' || sourceType === 'client') && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem'
        }}>
          <span>📹 Laptop / Phone Camera streaming live with real-time YOLO26n tracking.</span>
          <button onClick={() => handleSelectSource('device_camera')} className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}>
            Restart Cam
          </button>
        </div>
      )}

      {/* 3. IN/OUT Counting Line & Geometry Calibration (Restored & Enhanced) */}
      <div style={{
        background: calibrationMode === 'line' ? 'rgba(0, 240, 255, 0.12)' : calibrationMode === 'perspective' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(13, 19, 33, 0.7)',
        border: calibrationMode === 'line' ? '1px solid var(--accent-cyan)' : calibrationMode === 'perspective' ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '0.9rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <SlidersHorizontal size={15} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFF' }}>
              IN / OUT COUNTING LINE & CALIBRATION
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: calibrationMode === 'line' ? 'var(--accent-cyan)' : calibrationMode === 'perspective' ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: 600 }}>
            {calibrationMode === 'line' ? '● Dragging Line' : calibrationMode === 'perspective' ? '● 4 Corners' : 'Real-Time (0 ms)'}
          </span>
        </div>

        {/* Status Callout when in active calibration mode */}
        {calibrationMode === 'line' && (
          <div style={{
            fontSize: '0.73rem',
            color: '#00F0FF',
            background: 'rgba(0, 240, 255, 0.15)',
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            lineHeight: 1.4,
          }}>
            🟢 <strong>Line Calibration Active:</strong> Drag handles <strong>A</strong> or <strong>B</strong> directly on the video across the doorway or path. Click <strong>✓ Save Line Position</strong> when done.
          </div>
        )}

        {calibrationMode === 'perspective' && (
          <div style={{
            fontSize: '0.73rem',
            color: '#10B981',
            background: 'rgba(16, 185, 129, 0.15)',
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            lineHeight: 1.4,
          }}>
            🟢 <strong>4-Corner Homography Active:</strong> Drag the 4 corner pins on the video stream to align perspective floor geometry.
          </div>
        )}

        {/* Main Calibration Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.45rem' }}>
          <button
            onClick={() => onSetCalibrationMode && onSetCalibrationMode(calibrationMode === 'line' ? null : 'line')}
            className={`btn ${calibrationMode === 'line' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '0.55rem 0.5rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: calibrationMode === 'line' ? '#00F0FF' : undefined,
              color: calibrationMode === 'line' ? '#070B13' : undefined,
            }}
          >
            {calibrationMode === 'line' ? <CheckCircle2 size={14} /> : <Sliders size={13} />}
            <span>{calibrationMode === 'line' ? '✓ Save Line Position' : '📏 Adjust Counting Line'}</span>
          </button>

          <button
            onClick={handleFlipLine}
            className="btn btn-secondary"
            style={{ padding: '0.55rem 0.4rem', fontSize: '0.78rem' }}
            title="Swap Point A and Point B so IN becomes OUT and OUT becomes IN"
          >
            <ArrowLeftRight size={13} style={{ marginRight: '4px', color: 'var(--accent-amber)' }} />
            Flip IN/OUT
          </button>
        </div>

        {/* Secondary Calibration Modes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
          <button
            onClick={() => onSetCalibrationMode && onSetCalibrationMode(calibrationMode === 'perspective' ? null : 'perspective')}
            className={`btn ${calibrationMode === 'perspective' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '0.45rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: calibrationMode === 'perspective' ? '#10B981' : undefined,
              color: calibrationMode === 'perspective' ? '#06281E' : undefined,
            }}
          >
            <Layers size={13} />
            <span>{calibrationMode === 'perspective' ? '✓ Finish Corners' : 'Calibrate 4 Corners'}</span>
          </button>

          <button
            onClick={handleAutoCalibrate}
            className="btn btn-secondary"
            style={{
              padding: '0.45rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              background: 'rgba(0, 240, 255, 0.08)',
            }}
            title="Instantly auto-calibrate ground floor perspective"
          >
            <Zap size={13} style={{ color: 'var(--accent-cyan)' }} />
            <span>Auto Floor</span>
          </button>
        </div>

        {/* Camera Angle Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.1rem' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Camera Angle Presets:</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
            <button
              onClick={() => handleApplyPreset('corridor')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.69rem' }}
              title="Corridor / Hallway view"
            >
              Corridor
            </button>
            <button
              onClick={() => handleApplyPreset('entrance')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.69rem' }}
              title="Entrance doorway / Gate view"
            >
              Entrance
            </button>
            <button
              onClick={() => handleApplyPreset('floor')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.69rem' }}
              title="Wide facility floor"
            >
              Floor
            </button>
            <button
              onClick={() => handleApplyPreset('default')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.69rem' }}
              title="Reset to default geometry"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 1-Click Line Nudge & Center Reset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nudge Line Position (1-Click):
            </span>
            <button
              onClick={handleResetLineDefault}
              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.68rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Center Line
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
            <button
              onClick={() => handleNudgeLine('up')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.72rem', fontWeight: 700 }}
              title="Shift counting line UP by 5%"
            >
              ▲ Up
            </button>
            <button
              onClick={() => handleNudgeLine('down')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.72rem', fontWeight: 700 }}
              title="Shift counting line DOWN by 5%"
            >
              ▼ Down
            </button>
            <button
              onClick={() => handleNudgeLine('left')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.72rem', fontWeight: 700 }}
              title="Shift counting line LEFT by 5%"
            >
              ◄ Left
            </button>
            <button
              onClick={() => handleNudgeLine('right')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.72rem', fontWeight: 700 }}
              title="Shift counting line RIGHT by 5%"
            >
              ► Right
            </button>
          </div>
        </div>
      </div>

      {/* 4. Playback & Reset Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.4rem' }}>
        <button onClick={() => handleControl('resume')} className="btn btn-secondary" style={{ padding: '0.5rem 0.2rem', fontSize: '0.75rem' }} title="Resume Stream">
          <Play size={13} style={{ color: 'var(--accent-emerald)' }} />
          <span>Resume</span>
        </button>
        <button onClick={() => handleControl('pause')} className="btn btn-secondary" style={{ padding: '0.5rem 0.2rem', fontSize: '0.75rem' }} title="Pause Stream">
          <Pause size={13} style={{ color: 'var(--accent-amber)' }} />
          <span>Pause</span>
        </button>
        <button onClick={handleResetAnalytics} className="btn btn-secondary" style={{ padding: '0.5rem 0.2rem', fontSize: '0.75rem', borderColor: 'rgba(244,63,94,0.3)', color: '#F43F5E' }} title="Reset counts to 0">
          <RefreshCw size={13} />
          <span>Reset 0</span>
        </button>
        <button onClick={handleResetTracking} className="btn btn-secondary" style={{ padding: '0.5rem 0.2rem', fontSize: '0.75rem' }} title="Reset tracking IDs">
          <RefreshCw size={13} />
          <span>Tracks</span>
        </button>
      </div>

      {/* 5. Live Foot-Traffic Activity Feed (People In / Out) */}
      <div style={{
        background: 'rgba(7, 10, 19, 0.75)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '0.75rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FFF' }}>
              PEOPLE IN / OUT LOG
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            IN: {telemetry?.total_in ?? 0} | OUT: {telemetry?.total_out ?? 0}
          </span>
        </div>

        {recentEvents && recentEvents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '120px', overflowY: 'auto' }}>
            {recentEvents.slice(0, 5).map((evt, idx) => (
              <div
                key={evt.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: evt.direction === 'IN' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                  border: `1px solid ${evt.direction === 'IN' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                  borderRadius: '6px',
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.72rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {evt.direction === 'IN' ? (
                    <UserCheck size={13} style={{ color: '#10B981' }} />
                  ) : (
                    <UserMinus size={13} style={{ color: '#F43F5E' }} />
                  )}
                  <span style={{ fontWeight: 700, color: evt.direction === 'IN' ? '#10B981' : '#F43F5E' }}>
                    Person #{evt.track_id} {evt.direction === 'IN' ? 'ENTERED IN' : 'EXITED OUT'}
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                  {evt.time_str || new Date(evt.timestamp * 1000).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.4rem' }}>
            Awaiting line crossings… Walk across the counting line to increment!
          </div>
        )}
      </div>

      {/* 6. Confidence Threshold Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <span className="slider-label" style={{ color: 'var(--text-muted)' }}>DETECTION CONFIDENCE</span>
          <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {(confThreshold * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min="0.10"
          max="0.90"
          step="0.05"
          value={confThreshold}
          onChange={handleConfidenceChange}
          style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
        />
      </div>

      {/* 7. Privacy Mode Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span className="slider-label" style={{ color: 'var(--text-muted)' }}>PRIVACY PROTECTION</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
          {['none', 'blur', 'pixelate', 'blackout'].map((mode) => (
            <button
              key={mode}
              onClick={() => handlePrivacyChange(mode)}
              className={`btn ${privacyMode === mode ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.2rem', fontSize: '0.72rem', textTransform: 'capitalize' }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
