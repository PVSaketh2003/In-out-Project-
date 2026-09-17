import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import VideoPlayer from './components/VideoPlayer';
import TopViewPanel from './components/TopViewPanel';
import ControlsPanel from './components/ControlsPanel';
import RecentEventsList from './components/RecentEventsList';
import FlowHistoryChart from './components/FlowHistoryChart';
import SystemInfoModal from './components/SystemInfoModal';
import CalibrationModal from './components/CalibrationModal';
import DownloadAppModal from './components/DownloadAppModal';
import { wsService } from './services/websocket';
import { fetchConfig } from './services/api';
import {
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Layers,
  Activity,
  BarChart3,
} from 'lucide-react';

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [calibrationMode, setCalibrationMode] = useState(null); // 'line' | 'perspective' | null
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [showCalibrationGuide, setShowCalibrationGuide] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  // Connect to WebSocket on mount
  useEffect(() => {
    wsService.connect();

    const unsubTelemetry = wsService.subscribe((data) => {
      setTelemetry(data);
    });

    const unsubStatus = wsService.subscribeStatus((status) => {
      setWsStatus(status);
    });

    // Initial fallback fetch
    fetchConfig()
      .then((cfg) => {
        if (cfg) {
          setTelemetry((prev) => ({ ...prev, ...cfg }));
        }
      })
      .catch(console.error);

    return () => {
      unsubTelemetry();
      unsubStatus();
      wsService.disconnect();
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const handleSetCalibrationMode = (mode) => {
    setCalibrationMode(mode);
    wsService.send('set_calibration_mode', { mode });
  };

  return (
    <div className="app-container">
      {/* Top Navigation & Status Bar */}
      <Header
        telemetry={telemetry}
        wsStatus={wsStatus}
        onOpenSystemInfo={() => setShowSystemInfo(true)}
        onOpenCalibrationGuide={() => setShowCalibrationGuide(true)}
        onOpenDownloadModal={() => setShowDownloadModal(true)}
        onToggleFullscreen={handleToggleFullscreen}
      />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Main Clean Workspace: Dominant Video + Streamlined Controls */}
        <div className="dashboard-grid">
          {/* Left Column: Live Video Feed + Compact KPI Strip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <VideoPlayer
              telemetry={telemetry}
              calibrationMode={calibrationMode}
              onSetCalibrationMode={handleSetCalibrationMode}
            />

            {/* Compact Real-Time KPI Telemetry Bar */}
            <div className="compact-kpi-bar glass-panel" style={{ borderRadius: '12px' }}>
              <div className="kpi-item">
                <span className="kpi-label">Inside</span>
                <span className="kpi-val" style={{ color: 'var(--accent-cyan)' }}>
                  {telemetry?.occupancy ?? 0}
                </span>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-item">
                <span className="kpi-label">Total IN</span>
                <span className="kpi-val" style={{ color: 'var(--accent-emerald)' }}>
                  {telemetry?.total_in ?? 0}
                </span>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-item">
                <span className="kpi-label">Total OUT</span>
                <span className="kpi-val" style={{ color: 'var(--accent-rose)' }}>
                  {telemetry?.total_out ?? 0}
                </span>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-item">
                <span className="kpi-label">Active Tracks</span>
                <span className="kpi-val" style={{ color: 'var(--accent-purple)' }}>
                  {telemetry?.active_people ?? 0}
                </span>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-item">
                <span className="kpi-label">AI Processing</span>
                <span className="kpi-val" style={{ color: 'var(--accent-amber)' }}>
                  {telemetry?.fps ?? 0} <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>FPS</span>
                </span>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-item">
                <span className="kpi-label">Latency</span>
                <span className="kpi-val" style={{ color: '#e2e8f0' }}>
                  {telemetry?.detection_latency_ms ?? telemetry?.processing_latency_ms ?? 0}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>ms</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Video Source & Control Center */}
          <div className="side-panel">
            <ControlsPanel
              telemetry={telemetry}
              calibrationMode={calibrationMode}
              onSetCalibrationMode={handleSetCalibrationMode}
            />
          </div>
        </div>

        {/* Collapsible Advanced Section: Radar Map, Event Feed & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={() => setShowAdvancedTools((prev) => !prev)}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 1.25rem',
              width: '100%',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'rgba(13, 19, 33, 0.5)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={15} style={{ color: 'var(--accent-cyan)' }} />
              <span>Advanced Analytics & Spatial Radar</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)' }}>
              <span>{showAdvancedTools ? 'Hide' : 'Show'}</span>
              {showAdvancedTools ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {showAdvancedTools && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.25rem' }}>
              {/* Timeline Chart */}
              <FlowHistoryChart telemetry={telemetry} />

              {/* 2-Column Grid: 2D Radar Floor Map & Live Event Feed */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
                <TopViewPanel
                  telemetry={telemetry}
                  onSetCalibrationMode={handleSetCalibrationMode}
                />
                <RecentEventsList telemetry={telemetry} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showDownloadModal && (
        <DownloadAppModal
          onClose={() => setShowDownloadModal(false)}
        />
      )}

      {showSystemInfo && (
        <SystemInfoModal
          telemetry={telemetry}
          onClose={() => setShowSystemInfo(false)}
        />
      )}

      {showCalibrationGuide && (
        <CalibrationModal
          onClose={() => setShowCalibrationGuide(false)}
          onStartLineCalibration={() => handleSetCalibrationMode('line')}
          onStartPerspectiveCalibration={() => handleSetCalibrationMode('perspective')}
        />
      )}
    </div>
  );
}
