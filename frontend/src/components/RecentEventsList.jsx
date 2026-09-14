import React from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';

export default function RecentEventsList({ telemetry }) {
  const events = telemetry?.recent_events || [];

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div className="section-title">
          <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
          <span>CROSSING EVENT FEED</span>
        </div>
        <div className="badge" style={{ fontSize: '0.7rem' }}>
          <span>Live Ticker</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', textAlign: 'center', padding: '1.5rem 0' }}>
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
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isIN ? 'rgba(0, 240, 255, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      color: isIN ? 'var(--accent-cyan)' : 'var(--accent-rose)',
                    }}
                  >
                    {isIN ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: isIN ? 'var(--accent-cyan)' : 'var(--accent-rose)' }}>
                      Track #{evt.track_id}
                    </span>{' '}
                    <span style={{ color: '#fff' }}>crossed {evt.direction}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Occ: <strong style={{ color: '#fff' }}>{evt.occupancy}</strong></span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-dim)' }}>
                    <Clock size={11} />
                    {evt.time_str}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
