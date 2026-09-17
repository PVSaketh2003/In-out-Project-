import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import VideoPlayer from './components/VideoPlayer';
import TopViewPanel from './components/TopViewPanel';
import ControlsPanel from './components/ControlsPanel';
import RecentEventsList from './components/RecentEventsList';
import FlowHistoryChart from './components/FlowHistoryChart';
import SystemInfoModal from './components/SystemInfoModal';
import CalibrationModal from './components/CalibrationModal';
import AuthView from './components/AuthView';
import DownloadView from './components/DownloadView';
import { checkSession, logout } from './services/auth';
import { wsService } from './services/websocket';
import { fetchConfig } from './services/api';
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  Loader2,
} from 'lucide-react';

export default function App() {
  // Authentication & Session State
  const [isAuth, setIsAuth] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [authChecking, setAuthChecking] = useState(true);

  // App Navigation View: 'app' | 'download'
  const [currentView, setCurrentView] = useState('app');

  const [telemetry, setTelemetry] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [calibrationMode, setCalibrationMode] = useState(null); // 'line' | 'perspective' | null
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [showCalibrationGuide, setShowCalibrationGuide] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  // 1. Check Authentication on Mount
  useEffect(() => {
    checkSession()
      .then((res) => {
        if (res.authenticated) {
          setIsAuth(true);
          setUserEmail(res.email || localStorage.getItem('visioneye_auth_email') || 'user@example.com');
        } else {
          // Check local token as fallback
          const localToken = localStorage.getItem('visioneye_auth_token');
          const localEmail = localStorage.getItem('visioneye_auth_email');
          if (localToken && localEmail) {
            setIsAuth(true);
            setUserEmail(localEmail);
          } else {
            setIsAuth(false);
          }
        }
      })
      .catch(() => setIsAuth(false))
      .finally(() => setAuthChecking(false));
  }, []);

  // 2. Connect to WebSocket when authenticated
  useEffect(() => {
    if (!isAuth) return;

    wsService.connect();

    const unsubTelemetry = wsService.subscribe((data) => {
      setTelemetry(data);
    });

    const unsubStatus = wsService.subscribeStatus((status) => {
      setWsStatus(status);
    });

    fetchConfig()
      .then((cfg) => {
        if (cfg) setTelemetry((prev) => ({ ...prev, ...cfg }));
      })
      .catch(console.error);

    return () => {
      unsubTelemetry();
      unsubStatus();
      wsService.disconnect();
    };
  }, [isAuth]);

  const handleLogout = async () => {
    await logout();
    setIsAuth(false);
    setUserEmail('');
    setCurrentView('app');
  };

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

  // Initial session loading splash
  if (authChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#070a11',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent-cyan)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.9rem',
        gap: '0.75rem',
      }}>
        <Loader2 size={24} className="animate-spin" />
        <span>Initializing VisionEye...</span>
      </div>
    );
  }

  // Gated Access: Must authenticate first
  if (!isAuth) {
    return (
      <AuthView
        onAuthenticated={(email) => {
          setIsAuth(true);
          setUserEmail(email);
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Top Navigation & Status Bar */}
      <Header
        telemetry={telemetry}
        wsStatus={wsStatus}
        currentView={currentView}
        onChangeView={setCurrentView}
        userEmail={userEmail}
        onLogout={handleLogout}
        onOpenCalibrationGuide={() => setShowCalibrationGuide(true)}
        onToggleFullscreen={handleToggleFullscreen}
      />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* View 1: Direct Download Center */}
        {currentView === 'download' && (
          <DownloadView onBackToApp={() => setCurrentView('app')} />
        )}

        {/* View 2: Video Analytics Workspace */}
        {currentView === 'app' && (
          <>
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
                  <FlowHistoryChart telemetry={telemetry} />
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
          </>
        )}
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
