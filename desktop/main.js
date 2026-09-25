const { app, BrowserWindow, shell, ipcMain, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;

const BACKEND_PORT = 8000;
const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#070B13',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          background: #070B13;
          color: #F1F5F9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          border-radius: 12px;
          border: 1px solid rgba(0, 240, 255, 0.35);
          box-shadow: 0 0 35px rgba(0, 240, 255, 0.2);
          user-select: none;
        }
        .title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.1em;
          background: linear-gradient(135deg, #00F0FF, #10B981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }
        .subtitle {
          font-size: 11px;
          color: #64748B;
          letter-spacing: 0.05em;
          margin-bottom: 24px;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(0, 240, 255, 0.15);
          border-top-color: #00F0FF;
          border-radius: 50%;
          animation: spin 1s infinite linear;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .status {
          font-size: 12px;
          color: #94A3B8;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="title">VISIONEYE</div>
      <div class="subtitle">REAL-TIME CV ANALYTICS &bull; P V SAIRAM SAKETH</div>
      <div class="spinner"></div>
      <div class="status">Initializing YOLO26n ONNX Inference Engine...</div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#070B13',
    title: 'VisionEye - Real-Time Foot-Traffic Analytics',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load production bundled frontend or dev server
  if (IS_DEV && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const frontendDist = path.join(__dirname, 'dist-frontend', 'index.html');
    mainWindow.loadFile(frontendDist);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function checkBackendHealth(retries = 30, delay = 500) {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(true);
        }
      }).on('error', () => {
        if (attempts >= retries) {
          clearInterval(interval);
          console.warn('[Electron] Backend healthcheck timeout, proceeding anyway.');
          resolve(false);
        }
      });
    }, delay);
  });
}

function startBackendServer() {
  if (IS_DEV) {
    console.log('[Electron] In dev mode, assuming backend server is managed externally.');
    return;
  }

  const backendExecPath = path.join(process.resourcesPath, 'backend', 'visioneye-backend');
  const backendCwd = path.join(process.resourcesPath, 'backend');

  try {
    backendProcess = spawn(backendExecPath, [], {
      cwd: backendCwd,
      detached: false,
      stdio: 'ignore',
    });

    backendProcess.on('error', (err) => {
      console.error('[Electron] Failed to start bundled backend process:', err);
    });
  } catch (e) {
    console.error('[Electron] Spawn exception:', e);
  }
}

app.whenReady().then(async () => {
  // Automatically permit camera media access when requested by the app
  if (session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        return callback(true);
      }
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      if (permission === 'media') {
        return true;
      }
      return false;
    });
  }

  createSplashWindow();
  startBackendServer();
  await checkBackendHealth();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  if (backendProcess) {
    try {
      backendProcess.kill('SIGTERM');
    } catch (e) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
