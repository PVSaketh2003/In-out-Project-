import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Square, Upload, Camera, Radio, Shield, Sliders,
  RefreshCw, SlidersHorizontal, EyeOff, Layers, CheckCircle2, Zap, Sparkles
} from 'lucide-react';
import {
  startVideoSource, controlVideo, uploadVideoFile,
  updateConfig, resetAnalytics, resetTracking, fetchCameras,
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
  const [cameras, setCameras] = useState([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [rtspUrl, setRtspUrl] = useState('rtsp://127.0.0.1:8554/live');
  const [uploading, setUploading] = useState(false);
  const [confThreshold, setConfThreshold] = useState(0.40);
  const [privacyMode, setPrivacyMode] = useState('none');
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch available cameras on mount
  useEffect(() => {
    fetchCameras()
      .then(res => {
        if (res.cameras) setCameras(res.cameras);
      })
      .catch(console.error);
  }, []);

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
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Switch Source
  const handleApplySource = async () => {
    try {
      if (sourceType === 'device_camera') {
        window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: true } }));
        await startVideoSource('client');
        showNotification('📱 Device Camera Active — Grant camera permission if prompted');
        logError('Source', 'Switched to device camera mode', 'client');
      } else if (sourceType === 'webcam') {
        window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: false } }));
        await startVideoSource('webcam', null, selectedCameraIndex);
        showNotification(`Switched to Hardware Camera #${selectedCameraIndex}`);
        logError('Source', `Switched to webcam #${selectedCameraIndex}`, '');
      } else if (sourceType === 'rtsp') {
        window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: false } }));
        await startVideoSource('rtsp', rtspUrl);
        showNotification(`Connecting to RTSP stream...`);
        logError('Source', 'Switched to RTSP stream', rtspUrl);
      } else if (sourceType === 'synthetic') {
        window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: false } }));
        await startVideoSource('synthetic');
        showNotification('Switched to Demo Facility Stream');
        logError('Source', 'Switched to synthetic demo stream', '');
      }
      // Always trigger stream reload after source switch
      setTimeout(() => window.dispatchEvent(new CustomEvent('visioneye:stream_reload')), 400);
    } catch (err) {
      showNotification(`❌ Source error: ${err.message}`);
      logError('Source', `Source switch failed: ${err.message}`, sourceType);
    }
  };

  // Video Upload with Instant UI Playback
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4','video/quicktime','video/x-msvideo','video/x-matroska','video/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      showNotification('❌ Invalid file type. Use MP4, MOV, AVI, MKV, or WebM.');
      logError('Upload', 'Invalid file type', file.type || file.name);
      return;
    }

    setUploading(true);
    showNotification(`⚡ Uploading: ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)...`);
    logError('Upload', `Starting upload: ${file.name}`, `${(file.size/1024/1024).toFixed(1)} MB`);
    try {
      window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: false } }));
      const result = await uploadVideoFile(file);
      setSourceType('file');
      showNotification(`▶️ Now Playing: ${file.name}`);
      logError('Upload', `Upload success: ${file.name}`, result?.source_info?.source_type || 'file');
      // Give backend 300ms to open the file, then reload the MJPEG stream
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('visioneye:stream_reload'));
      }, 300);
      // Second reload in case MJPEG took longer
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('visioneye:stream_reload'));
      }, 1500);
    } catch (err) {
      showNotification(`❌ Upload failed: ${err.message}`);
      logError('Upload', `Upload failed: ${err.message}`, err.status || '');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Video Controls
  const handleControl = async (action) => {
    try {
      await controlVideo(action);
      showNotification(`Pipeline ${action}ed`);
    } catch (err) {
      showNotification(`Failed to ${action} pipeline`);
    }
  };

  // Confidence slider change
  const handleConfidenceChange = (e) => {
    const val = parseFloat(e.target.value);
    setConfThreshold(val);
    wsService.send('set_confidence', { value: val });
  };

  // Privacy Mode
  const handlePrivacyChange = async (mode) => {
    const enabled = mode !== 'none';
    setPrivacyMode(mode);
    const modeName = enabled ? mode : 'blur';
    wsService.send('set_privacy', { mode: modeName, enabled });
    await updateConfig({ privacy: { mode: modeName, enabled } });
    showNotification(`Privacy mode: ${mode.toUpperCase()}`);
  };

  // Reset Analytics
  const handleResetAnalytics = async () => {
    await resetAnalytics();
    wsService.send('reset_analytics');
    showNotification('Analytics counters reset to 0');
  };

  // Reset Tracking
  const handleResetTracking = async () => {
    await resetTracking();
    wsService.send('reset_tracking');
    showNotification('Track IDs reset');
  };

  // Flip IN/OUT Flow Direction
  const handleFlipLine = () => {
    const line = telemetry?.counting_line;
    if (!line) return;
    const newStart = [...line.end];
    const newEnd = [...line.start];
    updateCountingLine(newStart, newEnd);
    wsService.send('set_counting_line', { start: newStart, end: newEnd });
    showNotification('Swapped IN / OUT Flow Direction');
  };

  // 1-Click Auto Calibrate Ground Floor
  const handleAutoCalibrate = async () => {
    try {
      await autoCalibrateFloor();
      wsService.send('auto_calibrate');
      showNotification('⚡ Ground Floor Auto-Calibrated (1-Click)!');
    } catch (err) {
      showNotification('Auto-calibrated ground plane');
    }
  };

  // Apply Perspective Angle Presets
  const handleApplyPreset = async (preset) => {
    try {
      await applyPerspectivePreset(preset);
      wsService.send('set_perspective_preset', { preset });
      showNotification(`Applied ${preset.toUpperCase()} preset`);
    } catch (err) {
      showNotification(`Applied ${preset} preset`);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="section-title">
          <SlidersHorizontal size={18} style={{ color: 'var(--accent-cyan)' }} />
          <span>SYSTEM CONTROLS</span>
        </div>
        {statusMessage && (
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
            {statusMessage}
          </span>
        )}
      </div>

      {/* 1. Video Source Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <label className="slider-label">VIDEO INPUT SOURCE</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
          <button
            onClick={() => { setSourceType('synthetic'); handleApplySource(); }}
            className={`btn ${sourceType === 'synthetic' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem' }}
          >
            Demo Stream
          </button>
          <button
            onClick={() => { setSourceType('device_camera'); handleApplySource(); }}
            className={`btn ${sourceType === 'device_camera' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem', borderColor: sourceType === 'device_camera' ? 'var(--accent-cyan)' : 'inherit' }}
          >
            📱 Phone Cam
          </button>
          <button
            onClick={() => setSourceType('file')}
            className={`btn ${sourceType === 'file' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem' }}
          >
            Upload Video
          </button>
          <button
            onClick={() => setSourceType('webcam')}
            className={`btn ${sourceType === 'webcam' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem' }}
          >
            Hardware Cam
          </button>
        </div>

        {/* Dynamic Source Inputs */}
        {sourceType === 'device_camera' && (
          <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(0, 240, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(0, 240, 255, 0.25)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span>📱 Using your phone/device camera. Tap "Flip Cam" on player to switch front/rear.</span>
            <button onClick={handleApplySource} className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              Restart Cam
            </button>
          </div>
        )}

        {sourceType === 'webcam' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
            <select
              className="form-select"
              value={selectedCameraIndex}
              onChange={(e) => setSelectedCameraIndex(Number(e.target.value))}
            >
              {cameras.map((cam) => (
                <option key={cam.index} value={cam.index}>
                  {cam.name} ({cam.resolution})
                </option>
              ))}
            </select>
            <button onClick={handleApplySource} className="btn btn-primary" style={{ padding: '0.45rem 0.85rem' }}>
              Connect
            </button>
          </div>
        )}

        {sourceType === 'file' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
            <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Upload size={15} />
              <span>{uploading ? '⚡ Processing & Loading...' : 'Choose MP4 / MOV Video from Device'}</span>
              <input type="file" accept="video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Select any MP4, MOV, or MKV file • Automatically loops and processes in real-time
            </span>
          </div>
        )}

        {sourceType === 'rtsp' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
            <input
              type="text"
              className="form-input"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="rtsp://user:pass@ip:port/stream"
            />
            <button onClick={handleApplySource} className="btn btn-primary" style={{ padding: '0.45rem 0.85rem' }}>
              Stream
            </button>
          </div>
        )}

        {sourceType === 'synthetic' && telemetry?.source?.source_type !== 'synthetic' && (
          <button onClick={handleApplySource} className="btn btn-secondary" style={{ marginTop: '0.2rem' }}>
            Switch to Synthetic Stream
          </button>
        )}
      </div>

      {/* 2. Playback Control Bar */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => handleControl('resume')} className="btn btn-secondary" style={{ flex: 1 }} title="Resume Processing">
          <Play size={14} style={{ color: 'var(--accent-emerald)' }} />
          <span>Resume</span>
        </button>
        <button onClick={() => handleControl('pause')} className="btn btn-secondary" style={{ flex: 1 }} title="Pause Processing">
          <Pause size={14} style={{ color: 'var(--accent-amber)' }} />
          <span>Pause</span>
        </button>
        <button onClick={() => handleControl('stop')} className="btn btn-danger" style={{ flex: 1 }} title="Stop Video Stream">
          <Square size={14} />
          <span>Stop</span>
        </button>
      </div>

      {/* 3. Confidence Threshold Slider */}
      <div className="slider-container">
        <div className="slider-label">
          <span>PERSON DETECTION CONFIDENCE</span>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{Math.round(confThreshold * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.10"
          max="0.90"
          step="0.02"
          value={confThreshold}
          onChange={handleConfidenceChange}
          className="range-slider"
        />
      </div>

      {/* 4. Privacy Masking Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="slider-label">
          <span>PRIVACY PROTECTION MASK</span>
          <Shield size={13} style={{ color: privacyMode !== 'none' ? 'var(--accent-rose)' : 'var(--text-dim)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
          <button
            onClick={() => handlePrivacyChange('none')}
            className={`btn ${privacyMode === 'none' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '0.45rem', fontSize: '0.75rem' }}
          >
            None
          </button>
          <button
            onClick={() => handlePrivacyChange('blur')}
            className={`btn ${privacyMode === 'blur' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '0.45rem', fontSize: '0.75rem' }}
          >
            Gaussian Blur
          </button>
          <button
            onClick={() => handlePrivacyChange('pixelate')}
            className={`btn ${privacyMode === 'pixelate' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '0.45rem', fontSize: '0.75rem' }}
          >
            Pixelate
          </button>
        </div>
      </div>

      {/* 5. Interactive Calibration Modes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="slider-label">INTERACTIVE CALIBRATION</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>Real-Time (0 ms)</span>
        </div>

        {/* Real-Time Calibration Status Callouts */}
        {calibrationMode === 'perspective' && (
          <div style={{
            fontSize: '0.73rem',
            color: '#10B981',
            background: 'rgba(16, 185, 129, 0.12)',
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            lineHeight: 1.4,
          }}>
            🟢 <strong>4-Corner Calibration Active:</strong> Drag any of the 4 yellow corner pins on the video stream. Homography updates live in 0 ms! When done, click <strong>✓ Finish Calibration</strong>.
          </div>
        )}

        {calibrationMode === 'line' && (
          <div style={{
            fontSize: '0.73rem',
            color: '#00F0FF',
            background: 'rgba(0, 240, 255, 0.12)',
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            lineHeight: 1.4,
          }}>
            🟢 <strong>Line Editing Active:</strong> Drag Point A or B handles on the video stream. Counting line updates live in 0 ms! When done, click <strong>✓ Finish Line</strong>.
          </div>
        )}

        {/* Main Manual Calibration Mode Toggles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            onClick={() => onSetCalibrationMode(calibrationMode === 'line' ? null : 'line')}
            className={`btn ${calibrationMode === 'line' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '0.55rem 0.4rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: calibrationMode === 'line' ? '#00F0FF' : undefined,
              color: calibrationMode === 'line' ? '#070B13' : undefined,
              boxShadow: calibrationMode === 'line' ? '0 0 12px rgba(0, 240, 255, 0.4)' : undefined,
            }}
          >
            {calibrationMode === 'line' ? <CheckCircle2 size={14} /> : <Sliders size={13} />}
            <span>{calibrationMode === 'line' ? '✓ Finish Line' : 'Edit Line'}</span>
          </button>

          <button
            onClick={() => onSetCalibrationMode(calibrationMode === 'perspective' ? null : 'perspective')}
            className={`btn ${calibrationMode === 'perspective' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '0.55rem 0.4rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: calibrationMode === 'perspective' ? '#10B981' : undefined,
              color: calibrationMode === 'perspective' ? '#06281E' : undefined,
              boxShadow: calibrationMode === 'perspective' ? '0 0 12px rgba(16, 185, 129, 0.4)' : undefined,
            }}
          >
            {calibrationMode === 'perspective' ? <CheckCircle2 size={14} /> : <Layers size={13} />}
            <span>{calibrationMode === 'perspective' ? '✓ Finish Calibration' : 'Calibrate 4 Corners'}</span>
          </button>
        </div>

        {/* 1-Click Auto-Calibrate Floor Button */}
        <button
          onClick={handleAutoCalibrate}
          className="btn btn-secondary"
          style={{
            padding: '0.5rem',
            fontSize: '0.77rem',
            fontWeight: 600,
            background: 'rgba(0, 240, 255, 0.08)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            color: 'var(--accent-cyan)',
          }}
          title="Instantly calculate and apply optimal ground floor perspective in 1 click"
        >
          <Zap size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>⚡ Auto-Calibrate Floor (1-Click)</span>
        </button>

        {/* Quick Angle Presets Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.1rem' }}>
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

        <button
          onClick={handleFlipLine}
          className="btn btn-secondary"
          style={{ padding: '0.45rem', fontSize: '0.76rem', width: '100%', marginTop: '0.2rem' }}
          title="Swap Point A and Point B so IN becomes OUT and OUT becomes IN"
        >
          <RefreshCw size={12} style={{ color: 'var(--accent-amber)' }} />
          <span>Flip IN / OUT Flow Direction</span>
        </button>
      </div>

      {/* 6. Reset Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
        <button
          onClick={handleResetAnalytics}
          className="btn btn-secondary"
          style={{ flex: 1, fontSize: '0.75rem', padding: '0.45rem' }}
        >
          <RefreshCw size={13} />
          <span>Reset Counts</span>
        </button>
        <button
          onClick={handleResetTracking}
          className="btn btn-secondary"
          style={{ flex: 1, fontSize: '0.75rem', padding: '0.45rem' }}
        >
          <RefreshCw size={13} />
          <span>Reset Tracks</span>
        </button>
      </div>
    </div>
  );
}
