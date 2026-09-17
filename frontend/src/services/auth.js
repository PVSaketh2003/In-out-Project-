/**
 * VisionEye Email OTP Authentication Client Service
 */

const BASE_URL = window.location.port === '5173'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : '';

export async function sendOTP(email) {
  const resp = await fetch(`${BASE_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Failed to send verification code');
  }
  return data;
}

export async function verifyOTP(email, otp) {
  const resp = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, otp }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Invalid verification code');
  }

  if (data.token) {
    localStorage.setItem('visioneye_auth_token', data.token);
    localStorage.setItem('visioneye_auth_email', email);
  }
  return data;
}

export async function checkSession() {
  const token = localStorage.getItem('visioneye_auth_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const resp = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (resp.ok) {
      const data = await resp.json();
      return data;
    }
  } catch (err) {
    console.warn('[Auth] Session check error:', err);
  }
  return { authenticated: false };
}

export async function logout() {
  localStorage.removeItem('visioneye_auth_token');
  localStorage.removeItem('visioneye_auth_email');

  try {
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.warn('[Auth] Logout error:', err);
  }
  return { status: 'logged_out' };
}
