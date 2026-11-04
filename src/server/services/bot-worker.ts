// src/server/services/bot-worker.ts
// Background polling worker — runs inside the Express server process.
// Single-user bot: only processes the bot owner's account.
import { BOT_OWNER_ID } from '../middleware/auth.js';
import {
  getBotStateForWorker,
  getSettingsForWorker,
  getRulesForWorker as getRules,
  syncAdsForWorker,
  countUpdatesForWorker,
  updateAdForWorker,
  saveRankingForWorker as saveRanking,
  addLogForWorker as addLog,
  updateBotStateForWorker as updateBotState,
} from '../routes/api-handlers.js';
import { fetchMarketAds, getBybitAds, updateAdPrice } from './bybit-api.js';
import { computeRankings, parsePrice, computeTargetPrice } from './bot-algorithms.js';
import { queuePendingUpdate } from './pending-updates.js';

const DEFAULT_POLL_INTERVAL = Math.max(10000, parseInt(process.env.BOT_POLL_INTERVAL ?? '60000', 10));
let timer: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;
let workerEnabled = false;
const OWNER_ID = BOT_OWNER_ID;

// ── Per-user processing ───────────────────────────────────────────────────────

async function processUser(userId: string): Promise<void> {
  try {
    const state = await getBotStateForWorker(userId);
    if (state?.status !== 'running') return;

    const creds = await (await import('./supabase-db.js')).getCredentialsForBot(userId);
    if (!creds) {
      await updateBotState(userId, {
        status: 'error',
        message: 'Save valid Bybit API credentials before starting the bot.',
      });
      return;
    }

    const { apiKey, apiSecret } = creds;

    // Load all data in parallel
    const [rules, liveAds] = await Promise.all([
      getRules(userId),
      getBybitAds(creds),
    ]);
    const ads = await syncAdsForWorker(userId, liveAds);
    const selectedAds = ads.filter((a: any) => a.is_selected);
    if (selectedAds.length === 0) return;
    const ownedAdIds = new Set(ads.map((a: any) => String(a.ad_id ?? a.id)));

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const direction = rule.direction?.toUpperCase() as 'BUY' | 'SELL';
      const asset = String(rule.asset ?? 'USDT').toUpperCase();
      const fiatCurrency = String(rule.fiat_currency ?? 'USD').toUpperCase();
      const matchingAds = selectedAds.filter((ad: any) =>
        ad.direction?.toUpperCase() === direction &&
        String(ad.asset ?? '').toUpperCase() === asset &&
        String(ad.fiat_currency ?? ad.fiatCurrency ?? '').toUpperCase() === fiatCurrency &&
        String(ad.status ?? '').toLowerCase() === 'online',
      );
      if (!matchingAds.length) continue;

      const side = direction === 'BUY' ? 'Buy' : 'Sell';
      const marketAds = await fetchMarketAds(
        { side, asset, fiatCurrency, paymentMethodIds: rule.payment_method_ids },
        apiKey, apiSecret,
      );

      const ranking = computeRankings(marketAds.filter((ad: any) => !ownedAdIds.has(String(ad.id))), direction);

      // Save ranking snapshot
      await saveRanking(userId, {
        market_key: `${direction}_${asset}_${fiatCurrency}`,
        direction, asset, fiat_currency: fiatCurrency,
        competitors: ranking.competitors.map((c: any) => ({ id: c.id, price: c.price })),
        first_ranked: ranking.first, second_ranked: ranking.second, third_ranked: ranking.third,
        last_refresh: new Date().toISOString(), data_stale: false,
      }).catch(() => {});

      if (!ranking.competitors.length) continue;

      for (const myAd of matchingAds) {
        const bybitAdId = String(myAd.ad_id ?? myAd.id);
        const currentPrice = parsePrice(String(myAd.price ?? '0'));
        const targetPrice = computeTargetPrice(currentPrice, ranking, rule);
        if (!targetPrice) continue;

        if (rule.dry_run) {
          await addLog(userId, { level: 'info', category: 'pricing', message: `[DRY] ${bybitAdId}: ${currentPrice} -> ${targetPrice}`, ad_id: bybitAdId }).catch(() => {});
          continue;
        }

        const lastUpdate = Date.parse(String(myAd.last_update_time ?? ''));
        const minIntervalMs = Number(rule.min_interval_ms ?? 0);
        if (Number.isFinite(lastUpdate) && minIntervalMs > 0 && Date.now() - lastUpdate < minIntervalMs) continue;

        const hourCount = await countUpdatesForWorker(userId, bybitAdId, Date.now() - 60 * 60 * 1000);
        const dayCount = await countUpdatesForWorker(userId, bybitAdId, Date.now() - 24 * 60 * 60 * 1000);
        if (Number(rule.max_updates_per_hour) > 0 && hourCount >= Number(rule.max_updates_per_hour)) continue;
        if (Number(rule.max_updates_per_day) > 0 && dayCount >= Number(rule.max_updates_per_day)) continue;

        if (rule.manual_approval) {
          const queued = queuePendingUpdate({
            userId, adId: bybitAdId, ruleId: String(rule.id), ruleName: String(rule.name),
            currentPrice, targetPrice,
          });
          if (queued) {
            await addLog(userId, { level: 'info', category: 'safety', message: `Approval requested for ad ${bybitAdId}: ${currentPrice} -> ${targetPrice}`, ad_id: bybitAdId, previous_value: String(currentPrice), new_value: targetPrice }).catch(() => {});
          }
          continue;
        }

        const latestState = await getBotStateForWorker(userId);
        if (latestState?.status !== 'running') return;
        const result = await updateAdPrice(myAd, targetPrice, apiKey, apiSecret);
        if (result.success) {
          await updateAdForWorker(userId, bybitAdId, targetPrice);
          myAd.price = targetPrice;
          myAd.last_update_time = new Date().toISOString();
          await addLog(userId, { level: 'success', category: 'pricing', message: `Updated ad ${bybitAdId}: ${currentPrice} -> ${targetPrice}`, ad_id: bybitAdId, previous_value: String(currentPrice), new_value: targetPrice }).catch(() => {});
          const currentState = await getBotStateForWorker(userId);
          await updateBotState(userId, {
            last_successful_update: new Date().toISOString(),
            update_count: Number(currentState?.update_count ?? 0) + 1,
            error_count: 0,
          });
        } else {
          await addLog(userId, { level: 'error', category: 'pricing', message: `Update failed ${bybitAdId}: ${result.error}`, ad_id: bybitAdId }).catch(() => {});
        }
      }
    }

    await updateBotState(userId, { error_count: 0 }).catch(() => {});
  } catch (err: any) {
    console.error(`[Bot ${userId}]`, err.message);
    await addLog(userId, { level: 'error', category: 'bot', message: `Bot error: ${err.message}` }).catch(() => {});
    await updateBotState(userId, { status: 'error', message: err.message }).catch(() => {});
  }
}

// ── Master poll loop — single owner ─────────────────────────────────────────

async function pollAll() {
  if (isPolling) return;
  isPolling = true;
  try {
    // Single-user: only process the owner
    await processUser(OWNER_ID);
  } catch (err: any) {
    console.error('[Bot Worker] Poll failed:', err.message);
  } finally {
    isPolling = false;
    if (workerEnabled) {
      let interval = DEFAULT_POLL_INTERVAL;
      try {
        const settings = await getSettingsForWorker(OWNER_ID);
        const configured = Number(settings?.polling_interval_ms);
        if (Number.isFinite(configured) && configured > 0) interval = Math.max(10000, Math.min(3600000, configured));
      } catch (err: any) {
        console.warn('[Bot Worker] Could not load polling interval:', err.message);
      }
      timer = setTimeout(() => {
        timer = null;
        void pollAll();
      }, interval);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initializeBotWorker(): void {
  if (workerEnabled) return;
  workerEnabled = true;
  console.log(`[Bot Worker] Starting — owner: ${OWNER_ID}`);
  pollAll().catch((e: any) => console.error('[Bot Worker] Initial poll:', e.message));
}

export function wakeBotWorker(): void {
  if (!workerEnabled) return;
  if (timer) { clearTimeout(timer); timer = null; }
  void pollAll();
}

export function stopBotWorker(): void {
  workerEnabled = false;
  if (timer) { clearTimeout(timer); timer = null; }
  console.log('[Bot Worker] Stopped');
}
