import React from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';

export default function RecentEventsList({ telemetry }) {
  const events = telemetry?.recent_events || [];

  return (
    <div className="clean-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} style={{ color: '#2563eb' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>CROSSING EVENT FEED</span>
        </div>
        <div className="badge badge-green" style={{ fontSize: '0.7rem' }}>
          <span>Live</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '240px', overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem 0' }}>
            No line crossing events recorded yet.
          </div>
        ) : (
          events.map((evt) => {
            const isIN = evt.direction === 'IN';
            return (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  backgroundColor: isIN ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${isIN ? '#a7f3d0' : '#fecaca'}`,
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isIN ? '#10b981' : '#ef4444',
                      color: '#ffffff',
                    }}
                  >
                    {isIN ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, color: isIN ? '#047857' : '#b91c1c' }}>
                      Track #{evt.track_id}
                    </span>{' '}
                    <span style={{ color: '#475569', fontSize: '0.78rem' }}>
                      crossed {isIN ? 'ENTERED IN' : 'EXITED OUT'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.72rem' }}>
                  <Clock size={12} />
                  <span>{evt.time_str}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
