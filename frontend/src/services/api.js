/**
 * VisionEye REST API Client
 */

const API_BASE = '/api';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch (err) {
    console.error('fetchHealth error:', err);
    return null;
  }
}

export async function fetchCameras() {
  try {
    const res = await fetch(`${API_BASE}/cameras`);
    return await res.json();
  } catch (err) {
    console.error('fetchCameras error:', err);
    return { cameras: [] };
  }
}

export async function startVideoSource(sourceType, sourcePath = null, cameraIndex = null) {
  try {
    const res = await fetch(`${API_BASE}/video/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: sourceType,
        source_path: sourcePath,
        camera_index: cameraIndex,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === 'error') {
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error('startVideoSource error:', err);
    throw err;
  }
}

export async function pushClientFrame(frameBase64) {
  try {
    const res = await fetch(`${API_BASE}/video/client_frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: frameBase64 }),
    });
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function controlVideo(action) {
  try {
    const res = await fetch(`${API_BASE}/video/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (err) {
    console.error(`controlVideo ${action} error:`, err);
    throw err;
  }
}

export async function uploadVideoFile(file) {
  try {
    const formData = new FormData();
    formData.append('video', file);
    const res = await fetch(`${API_BASE}/video/upload`, {
      method: 'POST',
      body: formData,
    });
    return await res.json();
  } catch (err) {
    console.error('uploadVideoFile error:', err);
    throw err;
  }
}

export async function fetchConfig() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    return await res.json();
  } catch (err) {
    console.error('fetchConfig error:', err);
    return null;
  }
}

export async function updateConfig(configData) {
  try {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData),
    });
    return await res.json();
  } catch (err) {
    console.error('updateConfig error:', err);
    throw err;
  }
}

export async function updateCountingLine(start, end) {
  try {
    const res = await fetch(`${API_BASE}/counting-line`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end }),
    });
    return await res.json();
  } catch (err) {
    console.error('updateCountingLine error:', err);
    throw err;
  }
}

export async function updatePerspective(points) {
  try {
    const res = await fetch(`${API_BASE}/perspective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    });
    return await res.json();
  } catch (err) {
    console.error('updatePerspective error:', err);
    throw err;
  }
}

export async function applyPerspectivePreset(preset) {
  try {
    const res = await fetch(`${API_BASE}/perspective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
    });
    return await res.json();
  } catch (err) {
    console.error('applyPerspectivePreset error:', err);
    throw err;
  }
}

export async function autoCalibrateFloor() {
  try {
    const res = await fetch(`${API_BASE}/perspective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_calibrate: true }),
    });
    return await res.json();
  } catch (err) {
    console.error('autoCalibrateFloor error:', err);
    throw err;
  }
}

export async function resetAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/analytics/reset`, {
      method: 'POST',
    });
    return await res.json();
  } catch (err) {
    console.error('resetAnalytics error:', err);
    throw err;
  }
}

export async function resetTracking() {
  try {
    const res = await fetch(`${API_BASE}/tracking/reset`, {
      method: 'POST',
    });
    return await res.json();
  } catch (err) {
    console.error('resetTracking error:', err);
    throw err;
  }
}
