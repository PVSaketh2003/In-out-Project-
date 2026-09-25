import React from 'react';
import { Users, UserCheck, UserMinus, Target } from 'lucide-react';

export default function AnalyticsSummary({ telemetry }) {
  const occupancy = telemetry?.occupancy ?? 0;
  const totalIn = telemetry?.total_in ?? 0;
  const totalOut = telemetry?.total_out ?? 0;
  const activeTracks = telemetry?.active_people ?? 0;

  const stats = [
    {
      id: 'inside',
      label: 'People Inside',
      value: occupancy,
      icon: Users,
      color: '#2563eb', // Blue
      bgLight: '#eff6ff',
      borderColor: '#bfdbfe',
    },
    {
      id: 'entered',
      label: 'Entered (IN)',
      value: totalIn,
      icon: UserCheck,
      color: '#059669', // Emerald
      bgLight: '#ecfdf5',
      borderColor: '#a7f3d0',
    },
    {
      id: 'exited',
      label: 'Exited (OUT)',
      value: totalOut,
      icon: UserMinus,
      color: '#dc2626', // Red
      bgLight: '#fef2f2',
      borderColor: '#fecaca',
    },
    {
      id: 'tracked',
      label: 'Currently Tracked',
      value: activeTracks,
      icon: Target,
      color: '#7c3aed', // Purple
      bgLight: '#f5f3ff',
      borderColor: '#ddd6fe',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Foot-Traffic Analytics</h2>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Live person counter</span>
      </div>

      <div className="kpi-grid">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className="kpi-card"
              style={{
                borderTop: `3px solid ${item.color}`,
              }}
            >
              <div className="kpi-card-title">
                <Icon size={16} style={{ color: item.color }} />
                <span>{item.label}</span>
              </div>
              <div className="kpi-card-val" style={{ color: '#0f172a' }}>
                {item.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
