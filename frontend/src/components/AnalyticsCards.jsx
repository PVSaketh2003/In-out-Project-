import React from 'react';
import { Users, ArrowDownRight, ArrowUpRight, UserCheck, Zap, Clock, Activity } from 'lucide-react';

export default function AnalyticsCards({ telemetry }) {
  const occupancy = telemetry?.occupancy ?? 0;
  const totalIn = telemetry?.total_in ?? 0;
  const totalOut = telemetry?.total_out ?? 0;
  const activePeople = telemetry?.active_people ?? 0;
  const fps = telemetry?.fps ?? 0;
  const detLatency = telemetry?.detection_latency_ms ?? 0;
  const procLatency = telemetry?.processing_latency_ms ?? 0;

  return (
    <div className="metrics-grid">
      {/* 1. Current Occupancy */}
      <div className="glass-panel stat-card card-occupancy">
        <div className="stat-header">
          <span>CURRENT OCCUPANCY</span>
          <Users size={18} style={{ color: 'var(--accent-emerald)' }} />
        </div>
        <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
          {occupancy}
        </div>
        <div className="stat-sub">
          Active Inside (IN - OUT) &bull; Capacity Stable
        </div>
      </div>

      {/* 2. Total IN */}
      <div className="glass-panel stat-card card-in">
        <div className="stat-header">
          <span>TOTAL ENTERED (IN)</span>
          <ArrowDownRight size={18} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
          {totalIn}
        </div>
        <div className="stat-sub">
          Virtual Line Inward Crossings
        </div>
      </div>

      {/* 3. Total OUT */}
      <div className="glass-panel stat-card card-out">
        <div className="stat-header">
          <span>TOTAL EXITED (OUT)</span>
          <ArrowUpRight size={18} style={{ color: 'var(--accent-rose)' }} />
        </div>
        <div className="stat-value" style={{ color: 'var(--accent-rose)' }}>
          {totalOut}
        </div>
        <div className="stat-sub">
          Virtual Line Outward Crossings
        </div>
      </div>

      {/* 4. Active People Tracked */}
      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>ACTIVE TRACKS</span>
          <UserCheck size={18} style={{ color: 'var(--accent-purple)' }} />
        </div>
        <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>
          {activePeople}
        </div>
        <div className="stat-sub">
          ByteTrack Multi-Object IDs
        </div>
      </div>

      {/* 5. Real Processing FPS */}
      <div className="glass-panel stat-card card-fps">
        <div className="stat-header">
          <span>REAL PROCESSING FPS</span>
          <Activity size={18} style={{ color: 'var(--accent-amber)' }} />
        </div>
        <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
          {fps}
        </div>
        <div className="stat-sub">
          Rolling 30-Frame Frame Rate
        </div>
      </div>

      {/* 6. Detection Latency */}
      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>DETECTION LATENCY</span>
          <Zap size={18} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div className="stat-value" style={{ fontSize: '1.8rem', color: '#e2e8f0' }}>
          {detLatency} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ms</span>
        </div>
        <div className="stat-sub">
          YOLO26n Preprocess + ONNX + NMS
        </div>
      </div>

      {/* 7. Total Pipeline Latency */}
      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>TOTAL PIPELINE</span>
          <Clock size={18} style={{ color: 'var(--accent-emerald)' }} />
        </div>
        <div className="stat-value" style={{ fontSize: '1.8rem', color: '#e2e8f0' }}>
          {procLatency} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ms</span>
        </div>
        <div className="stat-sub">
          End-to-End Frame &bull; Tracking &bull; Overlay
        </div>
      </div>
    </div>
  );
}
