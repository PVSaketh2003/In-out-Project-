/**
 * WebGPU & Client Hardware Acceleration Diagnostics
 */

export async function detectHardwareCapabilities() {
  const info = {
    webgpu: false,
    webgl2: false,
    adapterName: 'Standard GPU / CPU',
    vendor: 'Generic',
    architecture: 'Standard',
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemory: navigator.deviceMemory || 8,
    isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
  };

  // 1. Probe WebGPU
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        info.webgpu = true;
        const adapterInfo = adapter.info || {};
        info.adapterName = adapterInfo.device || adapterInfo.description || 'WebGPU High-Performance Adapter';
        info.vendor = adapterInfo.vendor || 'Hardware Accelerated';
        info.architecture = adapterInfo.architecture || 'Direct Metal/Vulkan';
      }
    } catch (e) {
      console.warn('WebGPU check warning:', e);
    }
  }

  // 2. Fallback to WebGL2 for GPU adapter naming if WebGPU adapter info is unmasked
  if (!info.webgpu || info.adapterName === 'Standard GPU / CPU') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        info.webgl2 = true;
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          info.adapterName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || info.adapterName;
          info.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || info.vendor;
        }
      }
    } catch (e) {
      console.warn('WebGL check warning:', e);
    }
  }

  // 3. Apple Silicon heuristic
  if (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0) {
    info.adapterName = 'Apple M-Series GPU (Metal Accelerated)';
    info.vendor = 'Apple Inc.';
  } else if (/Mac/i.test(navigator.userAgent) && info.adapterName.includes('Apple')) {
    info.adapterName = 'Apple Silicon (Metal/WebGPU Accelerated)';
  }

  return info;
}
