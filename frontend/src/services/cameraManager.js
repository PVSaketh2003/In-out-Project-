/**
 * VisionEye Production Camera Management Service
 * 
 * Supports:
 * - Web Browsers (Chrome, Edge, Firefox, Safari)
 * - Mobile Devices (iOS Safari, Android Chrome/WebView) with front/rear camera selection
 * - Desktop Environments (macOS, Windows, Linux, Electron)
 * - Secure context detection & granular permission error handling
 * - Clean hardware track teardown to prevent camera LED retention & memory leaks
 * - Offscreen frame grabber pumping JPEG frames to backend AI pipeline
 */

import { pushClientFrame } from './api';

export class CameraManager {
  constructor(options = {}) {
    this.targetFps = options.targetFps || 15;
    this.frameQuality = options.frameQuality || 0.65;
    this.facingMode = options.facingMode || 'user'; // 'user' | 'environment'
    this.onStateChange = options.onStateChange || (() => {});
    this.onError = options.onError || (() => {});

    this.stream = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    this.frameTimer = null;
    this.isActive = false;
    this.isStreamingFrame = false;
  }

  /**
   * Checks if camera is supported on this browser/context.
   */
  static isSupported() {
    return !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  /**
   * Initializes and starts camera capture.
   */
  async start(facingMode = this.facingMode) {
    this.stop(); // Clean any existing stream first

    this.facingMode = facingMode;
    this.onStateChange('requesting_permission');

    // 1. Validate environment
    if (!CameraManager.isSupported()) {
      const isHttps = typeof window !== 'undefined' && window.isSecureContext;
      const errorMsg = !isHttps
        ? 'Camera requires a secure HTTPS connection or localhost.'
        : 'Camera is not supported on this browser or platform.';
      this.onError(errorMsg);
      this.onStateChange('unsupported');
      throw new Error(errorMsg);
    }

    // 2. Request MediaStream with ideal constraints
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('[CameraManager] getUserMedia failed:', err);
      let userMessage = 'Unable to access camera.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userMessage = 'Camera access blocked. Please allow camera permissions in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userMessage = 'Camera is currently in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        // Fallback to minimal constraint
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (retryErr) {
          userMessage = 'Camera resolution constraints could not be satisfied.';
        }
      }

      if (!this.stream) {
        this.onError(userMessage);
        this.onStateChange('permission_denied', { error: userMessage });
        throw new Error(userMessage);
      }
    }

    // 3. Create hidden video element and offscreen canvas
    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.setAttribute('autoplay', 'true');
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.setAttribute('muted', 'true');
      this.videoElement.style.display = 'none';
      this.videoElement.style.position = 'absolute';
      this.videoElement.style.width = '1px';
      this.videoElement.style.height = '1px';
      this.videoElement.style.opacity = '0';
      this.videoElement.style.pointerEvents = 'none';
      document.body.appendChild(this.videoElement);
    }

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640;
      this.canvas.height = 480;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    this.videoElement.srcObject = this.stream;

    // Wait for video stream to play
    try {
      await this.videoElement.play();
    } catch (playErr) {
      console.warn('[CameraManager] Video play warning:', playErr);
    }

    this.isActive = true;
    this.onStateChange('active', {
      facingMode: this.facingMode,
      trackCount: this.stream.getVideoTracks().length,
    });

    // 4. Start frame grabber loop
    this._startFrameLoop();
  }

  /**
   * Toggle between front and rear cameras (mobile / tablet).
   */
  async toggleFacingMode() {
    const nextMode = this.facingMode === 'user' ? 'environment' : 'user';
    return await this.start(nextMode);
  }

  /**
   * Pushes captured frames to backend pipeline at target FPS.
   */
  _startFrameLoop() {
    this._stopFrameLoop();

    const intervalMs = Math.round(1000 / this.targetFps);
    this.frameTimer = setInterval(async () => {
      if (!this.isActive || !this.videoElement || this.isStreamingFrame) return;

      if (this.videoElement.readyState >= 2 && this.videoElement.videoWidth > 0) {
        const vw = this.videoElement.videoWidth;
        const vh = this.videoElement.videoHeight;

        // Maintain canvas dimensions
        if (this.canvas.width !== 640 || this.canvas.height !== 480) {
          this.canvas.width = 640;
          this.canvas.height = 480;
        }

        this.ctx.drawImage(this.videoElement, 0, 0, 640, 480);
        const dataUrl = this.canvas.toDataURL('image/jpeg', this.frameQuality);

        this.isStreamingFrame = true;
        try {
          await pushClientFrame(dataUrl);
        } catch (e) {
          // Frame push handled silently
        } finally {
          this.isStreamingFrame = false;
        }
      }
    }, intervalMs);
  }

  _stopFrameLoop() {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    this.isStreamingFrame = false;
  }

  /**
   * Completely stops camera and releases all hardware tracks.
   */
  stop() {
    this._stopFrameLoop();
    this.isActive = false;

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch (e) {
        console.warn('[CameraManager] Track stop warning:', e);
      }
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      if (this.videoElement.parentNode) {
        this.videoElement.parentNode.removeChild(this.videoElement);
      }
      this.videoElement = null;
    }

    this.onStateChange('stopped');
  }
}
