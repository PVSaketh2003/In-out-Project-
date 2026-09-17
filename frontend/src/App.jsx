import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AnalyticsCards from './components/AnalyticsCards';
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
import { Layers, SlidersHorizontal, Activity } from 'lucide-react';

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [calibrationMode, setCalibrationMode] = useState(null); // 'line' | 'perspective' | null
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [showCalibrationGuide, setShowCalibrationGuide] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState('controls'); // 'controls' | 'radar' | 'events'

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
        {/* Top Analytics Metrics Grid */}
        <AnalyticsCards telemetry={telemetry} />

        {/* Main 2-Column CV Workspace Grid */}
        <div className="dashboard-grid">
          {/* Left Column: Live Video Feed & Timeline Charts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <VideoPlayer
              telemetry={telemetry}
              calibrationMode={calibrationMode}
              onSetCalibrationMode={handleSetCalibrationMode}
            />

            {/* Occupancy Timeline Chart */}
            <FlowHistoryChart telemetry={telemetry} />
          </div>

          {/* Right Column: Clean Tabbed Control Center */}
          <div className="side-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Tab Navigation Switcher */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem',
              background: 'rgba(10, 15, 29, 0.8)', padding: '0.3rem', borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <button
                onClick={() => setActiveSideTab('controls')}
                className={`btn ${activeSideTab === 'controls' ? 'btn-active' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.25rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
              >
                <SlidersHorizontal size={13} />
                <span>Controls</span>
              </button>

              <button
                onClick={() => setActiveSideTab('radar')}
                className={`btn ${activeSideTab === 'radar' ? 'btn-active' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.25rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
              >
                <Layers size={13} />
                <span>Radar Map</span>
              </button>

              <button
                onClick={() => setActiveSideTab('events')}
                className={`btn ${activeSideTab === 'events' ? 'btn-active' : 'btn-secondary'}`}
                style={{ padding: '0.45rem 0.25rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
              >
                <Activity size={13} />
                <span>Activity</span>
              </button>
            </div>

            {/* Tab Content */}
            {activeSideTab === 'controls' && (
              <ControlsPanel
                telemetry={telemetry}
                calibrationMode={calibrationMode}
                onSetCalibrationMode={handleSetCalibrationMode}
              />
            )}

            {activeSideTab === 'radar' && (
              <TopViewPanel
                telemetry={telemetry}
                onSetCalibrationMode={handleSetCalibrationMode}
              />
            )}

            {activeSideTab === 'events' && (
              <RecentEventsList telemetry={telemetry} />
            )}
          </div>
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
