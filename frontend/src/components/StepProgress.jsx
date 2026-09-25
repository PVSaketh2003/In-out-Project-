import React from 'react';
import { Video, Sliders, Play, BarChart2, Check } from 'lucide-react';

export default function StepProgress({ activeStep = 1, onStepClick }) {
  const steps = [
    { id: 1, label: 'Source', title: 'Choose Video Source', icon: Video },
    { id: 2, label: 'Configure', title: 'Set Counting Line', icon: Sliders },
    { id: 3, label: 'Analyze', title: 'Run Analytics', icon: Play },
    { id: 4, label: 'Results', title: 'Traffic Metrics', icon: BarChart2 },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '0.75rem 1.25rem',
        boxShadow: 'var(--shadow-xs)',
        boxSizing: 'border-box',
        overflowX: 'auto',
      }}
    >
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isCurrent = activeStep === step.id;
        const isPassed = activeStep > step.id;

        return (
          <React.Fragment key={step.id}>
            <div
              onClick={() => onStepClick?.(step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: onStepClick ? 'pointer' : 'default',
                userSelect: 'none',
                opacity: isCurrent || isPassed ? 1 : 0.55,
                transition: 'opacity 0.2s ease',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isCurrent ? '#2563eb' : isPassed ? '#10b981' : '#f1f5f9',
                  color: isCurrent || isPassed ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  boxShadow: isCurrent ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none',
                }}
              >
                {isPassed ? <Check size={14} /> : step.id}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: isCurrent ? 700 : 600, color: isCurrent ? '#0f172a' : '#475569' }}>
                  {step.label}
                </span>
                <span className="hide-on-mobile" style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  {step.title}
                </span>
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: isPassed ? '#10b981' : '#e2e8f0',
                  margin: '0 0.75rem',
                  minWidth: '20px',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
