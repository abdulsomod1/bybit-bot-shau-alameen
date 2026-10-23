// src/preload/preload.ts
// Preload script — runs before the renderer in a Node-like context.
// Exposes safe IPC bridges (contextBridge) so the renderer can talk to main.

import { contextBridge, ipcRenderer } from 'electron';

// ── API bridge exposed to the renderer window.api ─────────────────────────

const api = {
  // ── Bot controls ──────────────────────────────────────────────────────────
  startBot: () => ipcRenderer.invoke('start-bot'),
  pauseBot: () => ipcRenderer.invoke('pause-bot'),
  resumeBot: () => ipcRenderer.invoke('resume-bot'),
  stopBot: () => ipcRenderer.invoke('stop-bot'),
  getBotStatus: () => ipcRenderer.invoke('get-bot-status'),
  getBotState: () => ipcRenderer.invoke('get-bot-state'),

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('save-settings', settings),

  // ── Credentials ───────────────────────────────────────────────────────────
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  saveCredentials: (creds: { apiKey: string; apiSecret: string }) =>
    ipcRenderer.invoke('save-credentials', creds),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),
  testConnection: (creds: { apiKey: string; apiSecret: string }) =>
    ipcRenderer.invoke('test-connection', creds),

  // ── Ads ──────────────────────────────────────────────────────────────────
  getAds: () => ipcRenderer.invoke('get-ads'),
  setAdSelected: (adId: string, selected: boolean) =>
    ipcRenderer.invoke('set-ad-selected', adId, selected),
  approvePendingUpdate: (adId: string) =>
    ipcRenderer.invoke('approve-pending-update', adId),

  // ── Rules ────────────────────────────────────────────────────────────────
  getRules: () => ipcRenderer.invoke('get-rules'),
  saveRule: (rule: Record<string, unknown>) =>
    ipcRenderer.invoke('save-rule', rule),
  deleteRule: (id: string) => ipcRenderer.invoke('delete-rule', id),

  // ── Rankings ────────────────────────────────────────────────────────────
  getRankings: () => ipcRenderer.invoke('get-rankings'),
  refreshRankings: () => ipcRenderer.invoke('refresh-rankings'),

  // ── Logs ─────────────────────────────────────────────────────────────────
  getLogs: (filters?: Record<string, unknown>) =>
    ipcRenderer.invoke('get-logs', filters),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  exportLogs: () => ipcRenderer.invoke('export-logs'),

  // ── System ───────────────────────────────────────────────────────────────
  getCurrentIP: () => ipcRenderer.invoke('get-current-ip'),

  // ── Event listeners (renderer subscribes; main pushes) ─────────────────
  on: (channel: string, callback: (data: unknown) => void) => {
    const validChannels = [
      'bot-status-changed',
      'ads-updated',
      'rankings-updated',
      'log-entry-added',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, data) => callback(data));
    }
  },

  off: (channel: string, callback: (data: unknown) => void) => {
    ipcRenderer.removeListener(channel, (_event, data) => callback(data));
  },
};

contextBridge.exposeInMainWorld('api', api);

export {};
