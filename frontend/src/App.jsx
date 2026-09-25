import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import StepProgress from './components/StepProgress';
import VideoSourceSelector from './components/VideoSourceSelector';
import VideoPlayer from './components/VideoPlayer';
import AnalyticsSummary from './components/AnalyticsSummary';
import SettingsAccordion from './components/SettingsAccordion';
import PerformancePanel from './components/PerformancePanel';
import MobileActionBar from './components/MobileActionBar';
import CountingLineEditorModal from './components/CountingLineEditorModal';
import RTSPCameraModal from './components/RTSPCameraModal';
import DownloadView from './components/DownloadView';
import AuthView from './components/AuthView';
import CalibrationModal from './components/CalibrationModal';
import FlowHistoryChart from './components/FlowHistoryChart';
import RecentEventsList from './components/RecentEventsList';
import TopViewPanel from './components/TopViewPanel';

import { checkSession, logout } from './services/auth';
import { wsService } from './services/websocket';
import { fetchConfig, startVideoSource, uploadVideoFile, controlVideo } from './services/api';
import { ChevronDown, ChevronUp, BarChart3, Loader2 } from 'lucide-react';

export default function App() {
  // Authentication & Session State
  const [isAuth, setIsAuth] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [authChecking, setAuthChecking] = useState(true);

  // App Navigation View: 'app' | 'download'
  const [currentView, setCurrentView] = useState('app');

  // Video Source & Flow
  const [selectedSource, setSelectedSource] = useState('synthetic'); // 'synthetic' | 'file' | 'client' | 'rtsp'
  const [sourceName, setSourceName] = useState('Demo Pedestrian Video');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeviceCameraActive, setIsDeviceCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [isPaused, setIsPaused] = useState(false);

  // Modals & Panels
  const [showLineEditModal, setShowLineEditModal] = useState(false);
  const [showRTSPModal, setShowRTSPModal] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  // Telemetry & WebSocket
  const [telemetry, setTelemetry] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [activeStep, setActiveStep] = useState(3); // 1: Source, 2: Configure, 3: Analyze, 4: Results

  const fileInputRef = useRef(null);

  // 1. Check Authentication on Mount
  useEffect(() => {
    checkSession()
      .then((res) => {
        if (res.authenticated) {
          setIsAuth(true);
          setUserEmail(res.email || localStorage.getItem('visioneye_auth_email') || 'user@example.com');
        } else {
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

  // Switch Video Source: Demo Video
  const handleSelectSource = async (type) => {
    setSelectedSource(type);
    try {
      if (type === 'synthetic') {
        setIsDeviceCameraActive(false);
        setSourceName('Demo Pedestrian Video');
        await startVideoSource('synthetic');
        setActiveStep(3);
      } else if (type === 'client') {
        setIsDeviceCameraActive(true);
        setSourceName('Device Camera');
        await startVideoSource('client');
        setActiveStep(3);
      }
    } catch (err) {
      console.error('Switch source error:', err);
    }
  };

  // Trigger File Upload Picker
  const handleOpenUpload = () => {
    fileInputRef.current?.click();
  };

  // Video File Upload Handler
  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedSource('file');
    setSourceName(file.name);
    setUploading(true);
    setUploadProgress(0);

    try {
      await uploadVideoFile(file, (pct) => setUploadProgress(pct));
      setActiveStep(3);
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  // Connect RTSP Camera
  const handleConnectRTSP = async ({ cameraName, rtspUrl, username, password }) => {
    setSelectedSource('rtsp');
    setSourceName(cameraName || 'RTSP Camera');
    try {
      await startVideoSource('rtsp', rtspUrl, null, username, password);
      setActiveStep(3);
    } catch (err) {
      console.error('Connect RTSP error:', err);
    }
  };

  // Toggle Camera Facing Mode (Front vs Rear)
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Toggle Play/Pause
  const handleTogglePlay = async () => {
    const action = isPaused ? 'resume' : 'pause';
    try {
      await controlVideo(action);
      setIsPaused(!isPaused);
    } catch (e) {
      console.error('Play/pause error:', e);
    }
  };

  // Session loading splash
  if (authChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2563eb',
          gap: '0.75rem',
        }}
      >
        <Loader2 size={32} className="animate-spin" />
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
          Loading VisionEye Analytics...
        </span>
      </div>
    );
  }

  // Gated Access: OTP Login
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
      {/* Hidden File Input for Video Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChosen}
        accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v"
        style={{ display: 'none' }}
      />

      {/* Top Navigation & Status Bar */}
      <Header
        telemetry={telemetry}
        wsStatus={wsStatus}
        currentView={currentView}
        onChangeView={setCurrentView}
        userEmail={userEmail}
        onLogout={handleLogout}
        onOpenCalibrationGuide={() => setShowCalibrationModal(true)}
        onToggleFullscreen={handleToggleFullscreen}
      />

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* View 1: Download Center */}
        {currentView === 'download' && (
          <DownloadView onBackToApp={() => setCurrentView('app')} />
        )}

        {/* View 2: Video Analytics Workspace */}
        {currentView === 'app' && (
          <>
            {/* 1. Quick Video Source Pill Switcher */}
            <VideoSourceSelector
              selectedSource={selectedSource}
              onSelectSource={handleSelectSource}
              onOpenUpload={handleOpenUpload}
              onOpenRTSP={() => setShowRTSPModal(true)}
              uploading={uploading}
              uploadProgress={uploadProgress}
            />

            {/* 2. Key Foot-Traffic Counters (IN / OUT / INSIDE / TRACKED) */}
            <AnalyticsSummary telemetry={telemetry} />

            {/* 3. Responsive Video Analytics Viewport (With Direct Drag & Drop Pins) */}
            <VideoPlayer
              telemetry={telemetry}
              onOpenLineEdit={() => setShowLineEditModal(true)}
              onLineUpdated={(newStart, newEnd) => {
                setTelemetry((prev) => ({
                  ...prev,
                  counting_line: { start: newStart, end: newEnd },
                }));
              }}
              isDeviceCameraActive={isDeviceCameraActive}
              onToggleFacingMode={handleToggleFacingMode}
              facingMode={facingMode}
              sourceName={sourceName}
            />

            {/* 4. Collapsible Advanced Settings, Calibration & Radar (Never clutters main UI) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowAdvancedTools((prev) => !prev)}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1.15rem',
                  width: '100%',
                  borderRadius: '12px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart3 size={16} style={{ color: '#2563eb' }} />
                  <span>Advanced Settings, Calibration & Radar</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#64748b', fontSize: '0.8rem' }}>
                  <span>{showAdvancedTools ? 'Hide' : 'Configure'}</span>
                  {showAdvancedTools ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </button>

              {showAdvancedTools && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Settings Accordion (Counting Line, Calibration, Sensitivity) */}
                  <SettingsAccordion
                    telemetry={telemetry}
                    onOpenLineEdit={() => setShowLineEditModal(true)}
                    onStartPerspectiveCalibration={() => setShowCalibrationModal(true)}
                    onConfigUpdated={() => fetchConfig().then(setTelemetry).catch(console.error)}
                  />

                  {/* Performance Diagnostics */}
                  <PerformancePanel
                    telemetry={telemetry}
                    onResetCounters={() => fetchConfig().then(setTelemetry).catch(console.error)}
                  />

                  {/* Flow History & Spatial Radar */}
                  <FlowHistoryChart telemetry={telemetry} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                    <TopViewPanel
                      telemetry={telemetry}
                      onSetCalibrationMode={() => setShowCalibrationModal(true)}
                    />
                    <RecentEventsList telemetry={telemetry} />
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Fixed Bottom Action Bar */}
            <MobileActionBar
              isPaused={isPaused}
              onTogglePlay={handleTogglePlay}
              onOpenLineEdit={() => setShowLineEditModal(true)}
            />
          </>
        )}
      </main>

      {/* ── Modals & Dialogs ── */}
      {/* 1. Dedicated Counting Line Editor Modal */}
      <CountingLineEditorModal
        isOpen={showLineEditModal}
        onClose={() => setShowLineEditModal(false)}
        initialStart={telemetry?.counting_line?.start || [0.15, 0.72]}
        initialEnd={telemetry?.counting_line?.end || [0.85, 0.48]}
        onSaved={(newStart, newEnd) => {
          setTelemetry((prev) => ({
            ...prev,
            counting_line: { start: newStart, end: newEnd },
          }));
        }}
      />

      {/* 2. RTSP Network Camera Modal */}
      <RTSPCameraModal
        isOpen={showRTSPModal}
        onClose={() => setShowRTSPModal(false)}
        onConnect={handleConnectRTSP}
      />

      {/* 3. Camera Perspective Calibration Guide Modal */}
      {showCalibrationModal && (
        <CalibrationModal
          onClose={() => setShowCalibrationModal(false)}
          onStartLineCalibration={() => {
            setShowCalibrationModal(false);
            setShowLineEditModal(true);
          }}
          onStartPerspectiveCalibration={() => {
            setShowCalibrationModal(false);
          }}
        />
      )}
    </div>
  );
}
