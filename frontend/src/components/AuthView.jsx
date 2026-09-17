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
      onAuthenticated(res.email || email);
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'radial-gradient(circle at 50% 20%, rgba(0, 240, 255, 0.08) 0%, #070a11 75%)',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '2.5rem 2rem',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '1.5rem',
      }}>
        {/* Brand Icon & Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(16, 185, 129, 0.15))',
            border: '1px solid var(--border-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            boxShadow: '0 0 24px rgba(0, 240, 255, 0.25)',
          }}>
            <Eye size={28} />
          </div>
          <h1 style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-display)',
            color: '#FFFFFF',
          }}>
            VISIONEYE
          </h1>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            {step === 'email' ? 'Sign in to access video analytics' : 'Verify your email to continue'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{
            width: '100%',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            fontSize: '0.8rem',
            color: '#F43F5E',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textAlign: 'left',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Email Input */}
        {step === 'email' && (
          <form onSubmit={handleSendOTP} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                EMAIL ADDRESS
              </label>
              <div style={{
                position: 'relative',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-dim)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '0.8rem 0.85rem 0.8rem 2.4rem',
                    background: 'rgba(13, 19, 33, 0.8)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    color: '#FFF',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                borderRadius: '10px',
                marginTop: '0.5rem',
              }}
            >
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {/* Step 2: 6-Digit OTP Verification */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'rgba(0, 240, 255, 0.08)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              fontSize: '0.84rem',
              color: '#E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              textAlign: 'left',
            }}>
              <Mail size={22} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#FFF' }}>
                  Verification code sent to {maskEmail(email)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Please check your inbox (and Spam folder) for your 6-digit code.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • • • •"
                autoFocus
                required
                style={{
                  width: '100%',
                  maxWidth: '220px',
                  padding: '0.75rem 0',
                  textAlign: 'center',
                  fontSize: '1.6rem',
                  letterSpacing: '0.4em',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  background: 'rgba(13, 19, 33, 0.9)',
                  border: '1px solid var(--border-cyan)',
                  borderRadius: '12px',
                  color: '#FFF',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Code expires in 5 minutes
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                borderRadius: '10px',
              }}
            >
              {loading ? 'Verifying...' : 'Verify & Enter'}
            </button>

            {/* Resend & Back controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', width: '100%' }}>
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                ← Change Email
              </button>

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={resendCooldown > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? 'var(--text-dim)' : 'var(--accent-cyan)',
                  cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  fontWeight: 600,
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
