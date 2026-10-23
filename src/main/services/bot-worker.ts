import log from 'electron-log';
import { BrowserWindow } from 'electron';
import { getRules, getAds, updateBotState, addLog, saveRanking, saveAds, getRankings, getAppSettings, getBotState } from './database';
import { fetchMyAds, fetchMarketAds, updateAdPrice } from './bybit-api';
import { getCurrentPublicIP } from './ip-monitor';
import { rankCompetitors, buildMarketKey } from './ranking';
import { calculateTargetPrice, validatePriceChange } from './pricing';

let workerTimer: NodeJS.Timeout | null = null;
let isRunning = false;
let isPaused = false;
let lastUpdateTime: Record<string, number> = {};
let lastIPCheck = 0;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

function emit(channel: string, data: any): void {
  BrowserWindow.getAllWindows().forEach(win => { if (!win.isDestroyed()) win.webContents.send(channel, data); });
}

function canUpdateAd(rule: any, adId: string): boolean {
  if (rule.minIntervalMs && lastUpdateTime[adId] && Date.now() - lastUpdateTime[adId] < rule.minIntervalMs) return false;
  return !isPaused;
}

function markAdUpdated(adId: string): void { lastUpdateTime[adId] = Date.now(); }

async function refreshRankingsForRules(apiKey: string, apiSecret: string): Promise<void> {
  const rules = getRules().filter((r: any) => r.enabled);
  if (!rules.length) return;
  const mks = new Set<string>();
  rules.forEach((r: any) => mks.add(buildMarketKey(r.direction, r.asset, r.fiatCurrency)));
  for (const mk of mks) {
    const [direction, asset, fiat] = mk.split('_');
    const side = direction === 'BUY' ? 'Buy' : 'Sell';
    const rFM = rules.find((r: any) => r.direction === direction && r.asset === asset && r.fiatCurrency === fiat);
    try {
      const ads = await fetchMarketAds({ side: side as 'Buy' | 'Sell', asset, fiatCurrency: fiat, paymentMethodIds: rFM?.paymentMethodIds }, apiKey, apiSecret);
      const ranked = rankCompetitors(ads, direction as 'BUY' | 'SELL');
      const ranking = { marketKey: mk, direction: direction as 'BUY' | 'SELL', asset, fiatCurrency: fiat, competitors: ranked.slice(0, 20), firstRanked: ranked[0] || null, secondRanked: ranked[1] || null, thirdRanked: ranked[2] || null, lastRefresh: new Date().toISOString(), dataStale: false };
      saveRanking(ranking);
      addLog({ level: 'info', category: 'monitoring', message: `Market ${mk}: ${ranked.length} competitors found`, details: ranked.length >= 3 ? `Rank 1: ${ranked[0]?.price} | Rank 2: ${ranked[1]?.price} | Rank 3: ${ranked[2]?.price}` : `Only ${ranked.length} competitor(s) available` });
    } catch (err: any) {
      log.error('Rankings refresh error:', err);
      if (err.ret_code === 10003 || err.ret_code === 10007) {
        addLog({ level: 'error', category: 'ip', message: 'IP whitelist error - pausing bot', details: 'Update your Bybit API IP whitelist.' });
        saveRanking({ marketKey: mk, direction: direction as 'BUY' | 'SELL', asset, fiatCurrency: fiat, competitors: [], firstRanked: null, secondRanked: null, thirdRanked: null, lastRefresh: new Date().toISOString(), dataStale: true, refreshError: 'IP whitelist' });
        isPaused = true;
        emit('bot-status-changed', { status: 'paused', message: 'IP whitelist error - paused' });
      }
    }
  }
}

async function processRules(apiKey: string, apiSecret: string): Promise<void> {
  const rules = getRules().filter((r: any) => r.enabled && r.strategy !== 'monitor_only');
  if (!rules.length) return;
  const ads = getAds().filter((a: any) => a.isSelected);
  if (!ads.length) { addLog({ level: 'warning', category: 'bot', message: 'No ads selected' }); return; }
  for (const rule of rules) {
    const matchingAds = ads.filter((a: any) => a.direction === rule.direction && a.asset === rule.asset && a.fiatCurrency === rule.fiatCurrency);
    if (!matchingAds.length) continue;
    const rankings = getRankings();
    const ranking = rankings.find((r: any) => r.marketKey === buildMarketKey(rule.direction, rule.asset, rule.fiatCurrency));
    if (!ranking || ranking.dataStale) { addLog({ level: 'warning', category: 'pricing', message: `Rule "${rule.name}": stale data` }); continue; }
    const result = calculateTargetPrice(ranking, rule);
    if (result.reason?.includes('Monitor only')) continue;
    if (!result.valid) { addLog({ level: 'warning', category: 'pricing', message: `Rule "${rule.name}": ${result.reason}` }); continue; }
    for (const ad of matchingAds) {
      if (!canUpdateAd(rule, ad.id)) continue;
      const cp = parseFloat(ad.price), tp = result.price;
      if (isNaN(cp) || isNaN(tp)) continue;
      const cOk = validatePriceChange(cp, tp, rule.maxChangePercent);
      if (!cOk.valid) continue;
      const dev = Math.abs((tp - cp) / cp * 100);
      if (rule.maxDeviationPercent && dev > rule.maxDeviationPercent) continue;
      const prec = rule.pricePrecision || 2;
      if (Math.abs(tp - cp) < Math.pow(10, -prec)) continue;
      addLog({ level: 'info', category: 'pricing', message: `Ad ${ad.id}: ${cp}->${tp} (${result.reason})`, previousValue: String(cp), newValue: String(tp), adId: ad.id });
      if (rule.dryRun) { addLog({ level: 'info', category: 'bot', message: `[DRY RUN] Update ad ${ad.id} to ${tp}`, adId: ad.id }); markAdUpdated(ad.id); continue; }
      if (rule.manualApproval) { addLog({ level: 'info', category: 'bot', message: `[PENDING] Ad ${ad.id} -> ${tp}`, adId: ad.id }); emit('pending-update', { adId: ad.id, targetPrice: tp, currentPrice: cp, ruleName: rule.name }); continue; }
      const ur = await updateAdPrice(ad.id, String(tp), apiKey, apiSecret);
      if (ur.success) { addLog({ level: 'success', category: 'bot', message: `Updated ad ${ad.id} to ${tp}`, previousValue: String(cp), newValue: String(tp), adId: ad.id }); updateBotState({ last_successful_update: new Date().toISOString(), update_count: (getBotState()?.update_count || 0) + 1 }); emit('ads-updated', getAds()); markAdUpdated(ad.id); consecutiveErrors = 0; }
      else { addLog({ level: 'error', category: 'bot', message: `Failed ad ${ad.id}: ${ur.error}`, adId: ad.id }); consecutiveErrors++; }
    }
  }
}
async function checkIPChange(): Promise<void> {
  try {
    const ip = await getCurrentPublicIP();
    if (!ip || ip === 'unknown') return;
    const st = getBotState();
    if (st?.last_working_ip && ip !== st.last_working_ip) {
      addLog({ level: 'warning', category: 'ip', message: 'IP changed', details: `${st.last_working_ip} -> ${ip}` });
      isPaused = true;
      emit('bot-status-changed', { status: 'paused', message: 'IP changed - paused' });
      updateBotState({ status: 'paused' });
    }
  } catch (err: any) { log.error('IP check:', err); }
}

async function tick(key: string, secret: string): Promise<void> {
  if (!isRunning) return;
  const settings = getAppSettings();
  const interval = settings.pollingIntervalMs || 60000;
  try {
    const ads = await fetchMyAds(key, secret);
    const selIds = new Set(getAds().filter((a: any) => a.isSelected).map((a: any) => a.id));
    saveAds(ads.map((a: any) => ({ ...a, isSelected: selIds.has(a.id) })));
    emit('ads-updated', ads);
    await refreshRankingsForRules(key, secret);
    await processRules(key, secret);
    if (Date.now() - lastIPCheck > 300000) { lastIPCheck = Date.now(); await checkIPChange(); }
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      addLog({ level: 'error', category: 'bot', message: 'Max errors - pausing' });
      isPaused = true;
      emit('bot-status-changed', { status: 'paused', message: 'Too many errors' });
      updateBotState({ status: 'paused', error_count: consecutiveErrors });
    }
  } catch (err: any) {
    log.error('Tick error:', err);
    consecutiveErrors++;
    updateBotState({ error_count: consecutiveErrors });
    addLog({ level: 'error', category: 'bot', message: 'Tick error', details: err.message });
    if (err.ret_code === 10003 || err.ret_code === 10007) {
      isPaused = true;
      emit('bot-status-changed', { status: 'paused', message: 'IP error' });
      updateBotState({ status: 'paused' });
    }
  }
  if (isRunning) workerTimer = setTimeout(() => tick(key, secret), interval);
}

export async function refreshBotRankings(key: string, secret: string): Promise<void> { await refreshRankingsForRules(key, secret); }

export function startBotWorker(): void {
  if (isRunning) return;
  const { getCredentials } = require('./database');
  const creds = getCredentials();
  if (!creds) { log.warn('No credentials'); return; }
  isRunning = true; isPaused = false; consecutiveErrors = 0;
  addLog({ level: 'info', category: 'bot', message: 'Bot worker started' });
  tick(creds.apiKey, creds.apiSecret);
}

export function pauseBotWorker(): void { isPaused = true; addLog({ level: 'info', category: 'bot', message: 'Bot paused' }); }
export function resumeBotWorker(): void { isPaused = false; addLog({ level: 'info', category: 'bot', message: 'Bot resumed' }); }
export function stopBotWorker(): void { if (workerTimer) { clearTimeout(workerTimer); workerTimer = null; } isRunning = false; isPaused = false; addLog({ level: 'info', category: 'bot', message: 'Bot stopped' }); }