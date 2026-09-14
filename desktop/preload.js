const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  arch: process.arch,
  version: process.env.npm_package_version || '1.0.0',
  isDesktop: true,
  ping: () => ipcRenderer.invoke('ping'),
});
