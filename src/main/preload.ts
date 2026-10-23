import { contextBridge, ipcRenderer } from 'electron';

function on(channel: string, cb: (...args: any[]) => void) {
  const listener = (_e: any, ...args: any[]) => cb(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  startBot: () => ipcRenderer.invoke('start-bot'),
  pauseBot: () => ipcRenderer.invoke('pause-bot'),
  resumeBot: () => ipcRenderer.invoke('resume-bot'),
  stopBot: () => ipcRenderer.invoke('stop-bot'),
  getBotStatus: () => ipcRenderer.invoke('get-bot-status'),
  getBotState: () => ipcRenderer.invoke('get-bot-state'),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  saveCredentials: (creds: any) => ipcRenderer.invoke('save-credentials', creds),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),
  testConnection: () => ipcRenderer.invoke('test-connection'),
  getCurrentIP: () => ipcRenderer.invoke('get-current-ip'),
  getAppSettings: () => ipcRenderer.invoke('get-settings'),
  saveAppSettings: (s: any) => ipcRenderer.invoke('save-settings', s),
  getAds: () => ipcRenderer.invoke('get-ads'),
  setAdSelected: (adId: string, selected: boolean) => ipcRenderer.invoke('set-ad-selected', adId, selected),
  approvePendingUpdate: (adId: string) => ipcRenderer.invoke('approve-pending-update', adId),
  getRules: () => ipcRenderer.invoke('get-rules'),
  saveRule: (rule: any) => ipcRenderer.invoke('save-rule', rule),
  deleteRule: (id: string) => ipcRenderer.invoke('delete-rule', id),
  getRankings: () => ipcRenderer.invoke('get-rankings'),
  refreshRankings: () => ipcRenderer.invoke('refresh-rankings'),
  getLogs: (filters?: any) => ipcRenderer.invoke('get-logs', filters),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  exportLogs: () => ipcRenderer.invoke('export-logs'),
  on: (channel: string, callback: (...args: any[]) => void) => on(channel, callback),
});
