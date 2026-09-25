import React from 'react';
import { TrendingUp } from 'lucide-react';

export default function FlowHistoryChart({ telemetry }) {
  const history = telemetry?.flow_history || [];

  if (history.length < 2) {
    return (
      <div className="clean-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <TrendingUp size={18} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>OCCUPANCY & FLOW RATE TIMELINE</span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1.25rem 0' }}>
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
    <div className="clean-card" style={{ padding: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>TRAFFIC FLOW TIMELINE</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <span style={{ color: '#2563eb' }}>● Inside Occupancy</span>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Subtle grid lines */}
          <line x1={padX} y1={padY} x2={svgWidth - padX} y2={padY} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={padX} y1={svgHeight / 2} x2={svgWidth - padX} y2={svgHeight / 2} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={padX} y1={svgHeight - padY} x2={svgWidth - padX} y2={svgHeight - padY} stroke="#e2e8f0" strokeWidth="1" />

          {/* Flow curve */}
          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={occupancyPoints}
          />
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.72rem', color: '#94a3b8' }}>
        <span>60s ago</span>
        <span>Now</span>
      </div>
    </div>
  );
}
