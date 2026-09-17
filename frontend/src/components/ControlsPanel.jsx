import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Upload, Camera, Radio, Shield, Sliders,
  RefreshCw, SlidersHorizontal, EyeOff, Layers, CheckCircle2, Zap, Video, Film, ArrowLeftRight
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
  const [rtspUrl, setRtspUrl] = useState('rtsp://127.0.0.1:8554/live');
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
    setTimeout(() => setStatusMessage(''), 3000);
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
        showNotification('🎥 Switched to Facility Demo Stream');
      } else if (type === 'rtsp') {
        window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: false } }));
        await startVideoSource('rtsp', rtspUrl);
        showNotification('Connecting to RTSP stream...');
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

    // Mobile and desktop friendly format check
    const isVideo = file.type?.startsWith('video/') ||
      file.name?.match(/\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|ts)$/i) ||
      !file.type;

    if (!isVideo) {
      showNotification('❌ Please choose a video file (MP4, MOV, AVI, etc.)');
      return;
    }

    setUploading(true);
    showNotification(`⚡ Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);
    try {
      window.dispatchEvent(new CustomEvent('visioneye:device_camera_toggle', { detail: { active: false } }));
      const result = await uploadVideoFile(file);
      setSourceType('file');
      showNotification(`▶️ Playing: ${file.name}`);
      // Trigger stream reload immediately
      setTimeout(() => window.dispatchEvent(new CustomEvent('visioneye:stream_reload')), 150);
      setTimeout(() => window.dispatchEvent(new CustomEvent('visioneye:stream_reload')), 800);
    } catch (err) {
      showNotification(`❌ Upload error: ${err.message}`);
    } finally {
      setUploading(false);
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

  // Confidence slider change
  const handleConfidenceChange = (e) => {
    const val = parseFloat(e.target.value);
    setConfThreshold(val);
    wsService.send('set_confidence', { value: val });
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

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Title & Status Message */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
          <SlidersHorizontal size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>VIDEO SOURCE & CONTROLS</span>
        </div>
        {statusMessage && (
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {statusMessage}
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
          borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textAlign: 'center'
        }}>
          <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '0.7rem 1.5rem', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
            <Upload size={16} />
            <span>{uploading ? '⚡ Uploading & Loading...' : 'Choose MP4 / MOV Video'}</span>
            <input type="file" accept="video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Supports MP4, MOV, AVI, MKV up to 500 MB • Loops automatically with real-time AI
          </span>
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

      {/* 3. Playback & Counting Actions */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => handleControl('resume')} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem' }} title="Resume Stream">
          <Play size={14} style={{ color: 'var(--accent-emerald)' }} />
          <span>Resume</span>
        </button>
        <button onClick={() => handleControl('pause')} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem' }} title="Pause Stream">
          <Pause size={14} style={{ color: 'var(--accent-amber)' }} />
          <span>Pause</span>
        </button>
        <button onClick={handleFlipLine} className="btn btn-secondary" style={{ flex: 1.2, padding: '0.5rem' }} title="Swap IN and OUT counting direction">
          <ArrowLeftRight size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span>Flip IN/OUT</span>
        </button>
        <button onClick={handleResetAnalytics} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', borderColor: 'rgba(244,63,94,0.3)', color: '#F43F5E' }} title="Reset counters">
          <RefreshCw size={14} />
          <span>Reset 0</span>
        </button>
      </div>

      {/* 4. Confidence Threshold Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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

      {/* 5. Privacy Mode Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
