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
import { wsService } from './services/websocket';
import { fetchConfig } from './services/api';

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [calibrationMode, setCalibrationMode] = useState(null); // 'line' | 'perspective' | null
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [showCalibrationGuide, setShowCalibrationGuide] = useState(false);

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
        onToggleFullscreen={handleToggleFullscreen}
      />

      <main className="main-content">
        {/* Top High-Tech Metrics Grid */}
        <AnalyticsCards telemetry={telemetry} />

        {/* Main 2-Column CV Control & Visualization Grid */}
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

            {/* Live Crossing Event Activity Feed */}
            <RecentEventsList telemetry={telemetry} />
          </div>

          {/* Right Column: Top-View Bird's-Eye Minimap & Full Control Hub */}
          <div className="side-panel">
            {/* 2D Top-View / Bird's-Eye Canvas */}
            <TopViewPanel
              telemetry={telemetry}
              onSetCalibrationMode={handleSetCalibrationMode}
            />

            {/* Camera / Video Source & Detection Settings */}
            <ControlsPanel
              telemetry={telemetry}
              calibrationMode={calibrationMode}
              onSetCalibrationMode={handleSetCalibrationMode}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
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
