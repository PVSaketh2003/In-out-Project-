import React, { useState } from 'react';
import { Sliders, Compass, Shield, Target, ChevronDown, ChevronUp, Check, EyeOff } from 'lucide-react';
import { updateConfig, autoCalibrateFloor } from '../services/api';

export default function SettingsAccordion({
  telemetry,
  onOpenLineEdit,
  onStartPerspectiveCalibration,
  onConfigUpdated,
}) {
  const [openSection, setOpenSection] = useState(null); // 'line' | 'calib' | 'tracking' | 'privacy' | null
  const [confThreshold, setConfThreshold] = useState(telemetry?.confidence_threshold || 0.40);
  const [privacyEnabled, setPrivacyEnabled] = useState(telemetry?.privacy?.enabled || false);
  const [calibrating, setCalibrating] = useState(false);

  const toggleSection = (sec) => {
    setOpenSection(openSection === sec ? null : sec);
  };

  const handleConfChange = async (newVal) => {
    const val = parseFloat(newVal);
    setConfThreshold(val);
    try {
      await updateConfig({ confidence_threshold: val });
      onConfigUpdated?.();
    } catch (e) {
      console.error('Update confidence threshold error:', e);
    }
  };

  const handlePrivacyToggle = async () => {
    const newVal = !privacyEnabled;
    setPrivacyEnabled(newVal);
    try {
      await updateConfig({ privacy: { enabled: newVal, mode: 'blur' } });
      onConfigUpdated?.();
    } catch (e) {
      console.error('Update privacy error:', e);
    }
  };

  const handleAutoFloor = async () => {
    setCalibrating(true);
    try {
      await autoCalibrateFloor();
      onConfigUpdated?.();
    } catch (e) {
      console.error('Auto floor calibration error:', e);
    } finally {
      setCalibrating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Analytics Settings</h2>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Configure detection parameters</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Section 1: Counting Line */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('line')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.15rem', cursor: 'pointer', backgroundColor: openSection === 'line' ? '#f8fafc' : '#ffffff' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Sliders size={16} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>Counting Line</span>
            </div>
            {openSection === 'line' ? <ChevronUp size={16} style={{ color: '#64748b' }} /> : <ChevronDown size={16} style={{ color: '#64748b' }} />}
          </div>
          {openSection === 'line' && (
            <div style={{ padding: '1rem 1.15rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Define where people cross into or out of your monitored area.
              </p>
              <button
                type="button"
                onClick={onOpenLineEdit}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                <Sliders size={15} />
                <span>Open Counting Line Editor</span>
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Calibration */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('calib')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.15rem', cursor: 'pointer', backgroundColor: openSection === 'calib' ? '#f8fafc' : '#ffffff' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Compass size={16} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>Camera Calibration</span>
            </div>
            {openSection === 'calib' ? <ChevronUp size={16} style={{ color: '#64748b' }} /> : <ChevronDown size={16} style={{ color: '#64748b' }} />}
          </div>
          {openSection === 'calib' && (
            <div style={{ padding: '1rem 1.15rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Calibrate perspective distortion to enable spatial top-view radar tracking.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleAutoFloor}
                  disabled={calibrating}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem' }}
                >
                  {calibrating ? 'Calibrating...' : 'Auto Floor Grid'}
                </button>
                <button
                  type="button"
                  onClick={onStartPerspectiveCalibration}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem' }}
                >
                  4-Point Calibration
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Tracking & Sensitivity */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('tracking')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.15rem', cursor: 'pointer', backgroundColor: openSection === 'tracking' ? '#f8fafc' : '#ffffff' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Target size={16} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>Detection Confidence</span>
            </div>
            {openSection === 'tracking' ? <ChevronUp size={16} style={{ color: '#64748b' }} /> : <ChevronDown size={16} style={{ color: '#64748b' }} />}
          </div>
          {openSection === 'tracking' && (
            <div style={{ padding: '1rem 1.15rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569' }}>Minimum Confidence:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>
                  {Math.round(confThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.05"
                value={confThreshold}
                onChange={(e) => handleConfChange(e.target.value)}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Higher confidence reduces false positives; lower confidence detects distant people.
              </span>
            </div>
          )}
        </div>

        {/* Section 4: Privacy & Advanced */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('privacy')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.15rem', cursor: 'pointer', backgroundColor: openSection === 'privacy' ? '#f8fafc' : '#ffffff' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Shield size={16} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>Privacy & Masking</span>
            </div>
            {openSection === 'privacy' ? <ChevronUp size={16} style={{ color: '#64748b' }} /> : <ChevronDown size={16} style={{ color: '#64748b' }} />}
          </div>
          {openSection === 'privacy' && (
            <div style={{ padding: '1rem 1.15rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Anonymize Persons (Blur)</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Applies real-time Gaussian blur to detected pedestrians</span>
                </div>
                <button
                  type="button"
                  onClick={handlePrivacyToggle}
                  className={`btn ${privacyEnabled ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minHeight: '34px', padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                >
                  {privacyEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
