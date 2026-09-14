import React from 'react';
import { TrendingUp } from 'lucide-react';

export default function FlowHistoryChart({ telemetry }) {
  const history = telemetry?.flow_history || [];

  if (history.length < 2) {
    return (
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div className="section-title" style={{ marginBottom: '0.5rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--accent-emerald)' }} />
          <span>OCCUPANCY & FLOW RATE TIMELINE</span>
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', textAlign: 'center', padding: '1rem 0' }}>
          Collecting live traffic telemetry samples...
        </div>
      </div>
    );
  }

  // Calculate SVG line paths
  const maxOccupancy = Math.max(5, ...history.map((h) => h.occupancy));
  const svgWidth = 700;
  const svgHeight = 120;
  const padX = 20;
  const padY = 15;

  const getPoints = (key) => {
    return history
      .map((h, i) => {
        const x = padX + (i / (history.length - 1)) * (svgWidth - padX * 2);
        const y = svgHeight - padY - (h[key] / maxOccupancy) * (svgHeight - padY * 2);
        return `${x},${y}`;
      })
      .join(' ');
  };

  const occupancyPoints = getPoints('occupancy');

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div className="section-title">
          <TrendingUp size={18} style={{ color: 'var(--accent-emerald)' }} />
          <span>OCCUPANCY & FLOW RATE TIMELINE (LAST 30s)</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
            Occupancy
          </span>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '120px', display: 'block' }}>
          {/* Subtle horizontal grid lines */}
          <line x1={padX} y1={padY} x2={svgWidth - padX} y2={padY} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <line x1={padX} y1={svgHeight / 2} x2={svgWidth - padX} y2={svgHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <line x1={padX} y1={svgHeight - padY} x2={svgWidth - padX} y2={svgHeight - padY} stroke="rgba(255,255,255,0.1)" />

          {/* Occupancy Area Gradient */}
          <defs>
            <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Fill area */}
          <polygon
            points={`${padX},${svgHeight - padY} ${occupancyPoints} ${svgWidth - padX},${svgHeight - padY}`}
            fill="url(#occGradient)"
          />

          {/* Occupancy Line */}
          <polyline
            points={occupancyPoints}
            fill="none"
            stroke="var(--accent-emerald)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Latest point circle */}
          {history.length > 0 && (
            <circle
              cx={svgWidth - padX}
              cy={svgHeight - padY - (history[history.length - 1].occupancy / maxOccupancy) * (svgHeight - padY * 2)}
              r="4"
              fill="var(--accent-emerald)"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '0.35rem' }}>
        <span>{history[0]?.time || '00:00:00'}</span>
        <span>Peak: {maxOccupancy} Persons</span>
        <span>{history[history.length - 1]?.time || '00:00:00'}</span>
      </div>
    </div>
  );
}
