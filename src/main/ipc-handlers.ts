import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import log from 'electron-log';
import { getCredentials, saveCredentials, deleteCredentials, getAppSettings, saveAppSettings, getAds, updateAdSelected, getRules, saveRule, deleteRule, getRankings, getLogs, clearLogs, getBotState, updateBotState as dbUpdateBotState } from './services/database';
import { testBybitConnection } from './services/bybit-api';
import { getCurrentPublicIP } from './services/ip-monitor';
import { startBotWorker, pauseBotWorker, resumeBotWorker, stopBotWorker } from './services/bot-worker';

function saveBotState(state: Record<string, any>): void {
  try { dbUpdateBotState(state); } catch (e) { log.error('saveBotState error:', e); }
}

export function registerIpcHandlers(): void {
  // Bot controls
  ipcMain.handle('start-bot', async () => {
    try {
      const creds = getCredentials();
      if (!creds) return { success: false, error: 'No credentials saved' };
      startBotWorker();
      saveBotState({ status: 'running' });
      return { success: true };
    } catch (err: any) { log.error('start-bot error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('pause-bot', async () => {
    try { pauseBotWorker(); saveBotState({ status: 'paused' }); return { success: true }; }
    catch (err: any) { log.error('pause-bot error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('resume-bot', async () => {
    try { resumeBotWorker(); saveBotState({ status: 'running' }); return { success: true }; }
    catch (err: any) { log.error('resume-bot error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('stop-bot', async () => {
    try { stopBotWorker(); saveBotState({ status: 'stopped' }); return { success: true }; }
    catch (err: any) { log.error('stop-bot error:', err); return { success: false, error: err.message }; }
  });

  // Bot status & state
  ipcMain.handle('get-bot-status', async () => {
    try {
      const state = getBotState();
      const ip = await getCurrentPublicIP().catch(() => 'unknown');
      return {
        status: state?.status || 'stopped', message: state?.message,
        lastUpdate: state?.last_update, lastSuccessfulUpdate: state?.last_successful_update,
        currentIP: ip, lastWorkingIP: state?.last_working_ip,
        errorCount: state?.error_count || 0, updateCount: state?.update_count || 0, pendingUpdates: 0,
      };
    } catch (err: any) { log.error('get-bot-status error:', err); return { status: 'error', errorCount: 0, updateCount: 0, pendingUpdates: 0 }; }
  });

  ipcMain.handle('get-bot-state', async () => {
    try { return getBotState(); }
    catch (err: any) { log.error('get-bot-state error:', err); return null; }
  });

  // Credentials
  ipcMain.handle('get-credentials', async () => {
    try { return getCredentials(); }
    catch (err: any) { log.error('get-credentials error:', err); return null; }
  });

  ipcMain.handle('save-credentials', async (_event, creds: { apiKey: string; apiSecret: string }) => {
    try {
      if (!creds?.apiKey || !creds?.apiSecret) return { success: false, error: 'API key and secret are required' };
      saveCredentials(creds.apiKey, creds.apiSecret);
      const ip = await getCurrentPublicIP().catch(() => 'unknown');
      saveBotState({ last_working_ip: ip });
      return { success: true };
    } catch (err: any) { log.error('save-credentials error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('delete-credentials', async () => {
    try { deleteCredentials(); return { success: true }; }
    catch (err: any) { log.error('delete-credentials error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('test-connection', async (_event, creds: { apiKey: string; apiSecret: string }) => {
    try {
      if (!creds?.apiKey || !creds?.apiSecret) return { success: false, error: 'API key and secret are required' };
      const result = await testBybitConnection(creds.apiKey, creds.apiSecret);
      if (result.success) {
        const ip = await getCurrentPublicIP().catch(() => 'unknown');
        saveBotState({ last_working_ip: ip });
      }
      return result;
    } catch (err: any) { log.error('test-connection error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('get-current-ip', async () => {
    try { return await getCurrentPublicIP(); }
    catch (err: any) { log.error('get-current-ip error:', err); return 'unknown'; }
  });

  // Settings
  ipcMain.handle('get-settings', async () => {
    try { return getAppSettings(); }
    catch (err: any) { log.error('get-settings error:', err); return null; }
  });

  ipcMain.handle('save-settings', async (_event, settings: any) => {
    try { saveAppSettings(settings); return { success: true }; }
    catch (err: any) { log.error('save-settings error:', err); return { success: false, error: err.message }; }
  });

  // Ads
  ipcMain.handle('get-ads', async () => {
    try { return getAds(); }
    catch (err: any) { log.error('get-ads error:', err); return []; }
  });

  ipcMain.handle('set-ad-selected', async (_event, adId: string, selected: boolean) => {
    try { updateAdSelected(adId, selected); return { success: true }; }
    catch (err: any) { log.error('set-ad-selected error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('approve-pending-update', async (_event, _adId: string) => {
    try { return { success: true }; }
    catch (err: any) { log.error('approve-pending-update error:', err); return { success: false, error: err.message }; }
  });

  // Rules
  ipcMain.handle('get-rules', async () => {
    try { return getRules(); }
    catch (err: any) { log.error('get-rules error:', err); return []; }
  });

  ipcMain.handle('save-rule', async (_event, rule: any) => {
    try { saveRule(rule); return { success: true }; }
    catch (err: any) { log.error('save-rule error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('delete-rule', async (_event, id: string) => {
    try { deleteRule(id); return { success: true }; }
    catch (err: any) { log.error('delete-rule error:', err); return { success: false, error: err.message }; }
  });

  // Rankings
  ipcMain.handle('get-rankings', async () => {
    try { return getRankings(); }
    catch (err: any) { log.error('get-rankings error:', err); return []; }
  });

  ipcMain.handle('refresh-rankings', async () => {
    try {
      const creds = getCredentials();
      if (!creds) return { success: false, error: 'No credentials saved' };
      const { refreshBotRankings } = require('./services/bot-worker');
      await refreshBotRankings(creds.apiKey, creds.apiSecret);
      BrowserWindow.getAllWindows().forEach(win => { if (!win.isDestroyed()) win.webContents.send('rankings-updated', getRankings()); });
      return { success: true };
    } catch (err: any) { log.error('refresh-rankings error:', err); return { success: false, error: err.message }; }
  });

  // Logs
  ipcMain.handle('get-logs', async (_event, filters?: any) => {
    try { return getLogs(filters); }
    catch (err: any) { log.error('get-logs error:', err); return []; }
  });

  ipcMain.handle('clear-logs', async () => {
    try { clearLogs(); return { success: true }; }
    catch (err: any) { log.error('clear-logs error:', err); return { success: false, error: err.message }; }
  });

  ipcMain.handle('export-logs', async () => {
    try {
      const logs = getLogs();
      const result = await dialog.showSaveDialog({
        title: 'Export Logs', defaultPath: `bybit-p2p-logs-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, JSON.stringify(logs, null, 2));
        return { success: true, path: result.filePath };
      }
      return { success: false, error: 'Cancelled' };
    } catch (err: any) { log.error('export-logs error:', err); return { success: false, error: err.message }; }
  });

  log.info('All IPC handlers registered');
}

export function emitToRenderer(channel: string, data: any): void {
  BrowserWindow.getAllWindows().forEach(win => { if (!win.isDestroyed()) win.webContents.send(channel, data); });
}