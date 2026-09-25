import React, { useState, useEffect } from 'react';
import { Eye, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { sendOTP, verifyOTP } from '../services/auth';

export default function AuthView({ onAuthenticated }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const maskEmail = (val) => {
    if (!val || !val.includes('@')) return val;
    const [user, domain] = val.split('@');
    if (user.length <= 2) return `${user[0]}***@${domain}`;
    return `${user.slice(0, 2)}***@${domain}`;
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await sendOTP(email);
      setStep('otp');
      setResendCooldown(30);
      setOtp('');
    } catch (err) {
      setError(err.message || 'Failed to send verification code to your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await verifyOTP(email, otp);
      if (res && (res.token || res.status === 'authenticated' || res.message)) {
        onAuthenticated(email);
      } else {
        setError('Invalid verification code. Please check your inbox and try again.');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#f8fafc',
        backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)',
        backgroundSize: '24px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="clean-card"
        style={{
          maxWidth: '440px',
          width: '100%',
          padding: '2.25rem 2rem',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.5rem',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
            }}
          >
            <Eye size={26} />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            VisionEye
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {step === 'email' ? 'Sign in to access real-time video analytics' : 'Enter the verification code sent to your email'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              width: '100%',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '0.65rem 0.85rem',
              fontSize: '0.82rem',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textAlign: 'left',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Email Input */}
        {step === 'email' && (
          <form onSubmit={handleSendOTP} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
              <label className="input-label">Email Address</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="email"
                  className="input-field"
                  style={{ paddingLeft: '2.4rem' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoFocus
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Continue with Email</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Verification OTP code is delivered from <strong>pvsaketh1@gmail.com</strong>
            </div>
          </form>
        )}

        {/* Step 2: 6-Digit OTP Input */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.6rem 0.85rem',
                backgroundColor: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe',
                fontSize: '0.8rem',
                color: '#1e40af',
              }}
            >
              <CheckCircle2 size={15} />
              <span>Code sent to <strong>{maskEmail(email)}</strong></span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <label className="input-label" style={{ textAlign: 'center' }}>
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                autoFocus
                required
                style={{
                  width: '100%',
                  maxWidth: '240px',
                  padding: '0.85rem 1rem',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: '#ffffff',
                  border: '2px solid #2563eb',
                  borderRadius: '12px',
                  outline: 'none',
                  boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>Verify & Access Analytics</span>
                </>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <button
                type="button"
                onClick={() => setStep('email')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Change email
              </button>

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={resendCooldown > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? '#94a3b8' : '#2563eb',
                  fontWeight: 600,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
