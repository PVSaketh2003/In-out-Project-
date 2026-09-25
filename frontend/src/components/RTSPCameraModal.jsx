import React, { useState } from 'react';
import { X, Radio, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, ShieldCheck, Wifi } from 'lucide-react';
import { testRtspConnection } from '../services/api';

export default function RTSPCameraModal({ isOpen, onClose, onConnect }) {
  const [cameraName, setCameraName] = useState('Office Lobby Camera');
  const [rtspUrl, setRtspUrl] = useState('rtsp://192.168.1.100:554/stream');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { status, state, message, technical_details }
  const [showTechnical, setShowTechnical] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!rtspUrl || !rtspUrl.startsWith('rtsp://')) {
      setTestResult({
        status: 'failed',
        state: 'invalid_url',
        message: 'Please enter a valid RTSP stream URL starting with rtsp://',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testRtspConnection(rtspUrl, username, password);
    setTestResult(res);
    setTesting(false);
  };

  const handleConnect = (e) => {
    e?.preventDefault();
    if (!rtspUrl) return;

    onConnect({
      cameraName,
      rtspUrl,
      username,
      password,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Radio size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Connect RTSP Camera</h2>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Connect an IP network camera over your local network</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Local Network Guidance Banner */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#1e40af' }}>
          <Wifi size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Same Local Network Required:</strong> To use an RTSP camera, your camera and the VisionEye processing device must be connected to the same Wi-Fi/LAN router.
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">Camera Name</label>
            <input
              type="text"
              className="input-field"
              value={cameraName}
              onChange={(e) => setCameraName(e.target.value)}
              placeholder="e.g. Office Front Gate"
              required
            />
          </div>

          <div>
            <label className="input-label">Camera Stream URL (RTSP)</label>
            <input
              type="text"
              className="input-field"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="rtsp://192.168.1.100:554/stream"
              required
            />
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>
              Example: rtsp://192.168.1.120:554/live/ch0 or rtsp://camera-ip/h264
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="input-label">Username (Optional)</label>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="input-label">Password (Optional)</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Test Connection Button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="btn btn-secondary"
              style={{ width: '100%', minHeight: '44px' }}
            >
              {testing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Testing Camera Connectivity...</span>
                </>
              ) : (
                <>
                  <Wifi size={16} />
                  <span>Test Camera Connection</span>
                </>
              )}
            </button>

            {/* Test Result Message */}
            {testResult && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: testResult.status === 'connected' ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${testResult.status === 'connected' ? '#a7f3d0' : '#fecaca'}`,
                  color: testResult.status === 'connected' ? '#047857' : '#b91c1c',
                  fontSize: '0.82rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  {testResult.status === 'connected' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{testResult.message}</span>
                </div>

                {/* Optional Expandable Technical Details */}
                {testResult.technical_details && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowTechnical(!showTechnical)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        fontSize: '0.75rem',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        marginTop: '0.2rem',
                      }}
                    >
                      <span>Technical Details</span>
                      {showTechnical ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {showTechnical && (
                      <div
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.7)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          marginTop: '0.35rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          color: '#334155',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                        }}
                      >
                        {Object.entries(testResult.technical_details).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>{k}:</span>
                            <span style={{ fontWeight: 600 }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ flex: 2 }}
            >
              Connect Camera
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
