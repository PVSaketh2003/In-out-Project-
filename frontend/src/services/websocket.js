/**
 * VisionEye Real-Time WebSocket Client
 */

class VisionEyeWebSocket {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.reconnectTimer = null;
    this.isConnected = false;
    this.url = this._getWebSocketUrl();
  }

  _getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || '127.0.0.1';
    const port = '8000'; // Direct backend ASGI port for low latency
    return `${protocol}//${host}:${port}/ws/analytics/`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this._notifyStatus('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'telemetry' && payload.data) {
            this._notifyMessage(payload.data);
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      this.ws.onclose = (e) => {
        this.isConnected = false;
        this._notifyStatus('disconnected');
        this._scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        this.isConnected = false;
        this._notifyStatus('error');
        this.ws.close();
      };
    } catch (e) {
      this.isConnected = false;
      this._notifyStatus('error');
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  subscribeStatus(callback) {
    this.statusListeners.add(callback);
    callback(this.isConnected ? 'connected' : 'disconnected');
    return () => this.statusListeners.delete(callback);
  }

  _notifyMessage(data) {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  _notifyStatus(status) {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  send(action, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...payload }));
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsService = new VisionEyeWebSocket();
