import React from 'react';
import { X, Video, Download, Sliders, Shield, HelpCircle, LogOut, CheckCircle2, Cpu } from 'lucide-react';

export default function MobileMenu({
  isOpen,
  onClose,
  currentView,
  onChangeView,
  userEmail,
  onLogout,
  onOpenSettings,
  onOpenHelp,
  fps = 0
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '82%',
          maxWidth: '320px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.25rem 1rem max(1.25rem, env(safe-area-inset-bottom))',
          boxSizing: 'border-box',
          animation: 'slideLeft 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top: Header & Close */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <Video size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>VISIONEYE</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Foot-Traffic Analytics</div>
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

          {/* Nav Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={() => {
                onChangeView('app');
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: currentView === 'app' ? '#eff6ff' : 'transparent',
                color: currentView === 'app' ? '#2563eb' : '#334155',
                fontWeight: currentView === 'app' ? 700 : 500,
                fontSize: '0.9rem',
                textAlign: 'left',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              <Video size={18} />
              <span>Video Analytics</span>
            </button>

            <button
              onClick={() => {
                onChangeView('download');
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: currentView === 'download' ? '#eff6ff' : 'transparent',
                color: currentView === 'download' ? '#2563eb' : '#334155',
                fontWeight: currentView === 'download' ? 700 : 500,
                fontSize: '0.9rem',
                textAlign: 'left',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              <Download size={18} />
              <span>Download App</span>
            </button>

            <button
              onClick={() => {
                onOpenSettings?.();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#334155',
                fontWeight: 500,
                fontSize: '0.9rem',
                textAlign: 'left',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              <Sliders size={18} />
              <span>Settings & Calibration</span>
            </button>

            <button
              onClick={() => {
                onOpenHelp?.();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#334155',
                fontWeight: 500,
                fontSize: '0.9rem',
                textAlign: 'left',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              <HelpCircle size={18} />
              <span>Help & User Guide</span>
            </button>
          </div>
        </div>

        {/* Bottom: User Info & Logout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
          {/* Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.75rem' }}>
            <span style={{ color: '#64748b' }}>Processing Speed</span>
            <span style={{ fontWeight: 700, color: '#2563eb' }}>{fps} FPS</span>
          </div>

          {/* User Account */}
          {userEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ fontSize: '0.75rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail}
              </span>
            </div>
          )}

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.75rem',
              borderRadius: '10px',
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
