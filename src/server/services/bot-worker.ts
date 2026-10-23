// src/server/services/bot-worker.ts
// Background polling worker — runs inside the Express server process.
// Polls Bybit P2P for each active user and adjusts prices per rules.
import { supabaseAdmin } from './supabase-db.js';
import { getAllActiveUserIds } from './db-helpers.js';
import {
  getRulesForWorker as getRules,
  getAdsForWorker as getAds,
  saveRankingForWorker as saveRanking,
  addLogForWorker as addLog,
  updateBotStateForWorker as updateBotState,
} from '../routes/api-handlers.js';
import { fetchMarketAds, updateAdPrice } from './bybit-api.js';
import { computeRankings, parsePrice, computeTargetPrice } from './bot-algorithms.js';

const POLL_INTERVAL = parseInt(process.env.BOT_POLL_INTERVAL ?? '60000', 10);
let timer: ReturnType<typeof setInterval> | null = null;

// ── Per-user processing ───────────────────────────────────────────────────────

async function processUser(userId: string): Promise<void> {
  const creds = await (await import('./supabase-db.js')).getCredentialsForBot(userId);
  if (!creds) return;

  const { apiKey, apiSecret } = creds;

  try {
    // Load all data in parallel
    const [rules, ads] = await Promise.all([getRules(userId), getAds(userId)]);
    const selectedAdIds = new Set(ads.filter((a) => a.is_selected).map((a) => a.id));
    if (selectedAdIds.size === 0) return;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const direction = rule.direction?.toUpperCase() as 'BUY' | 'SELL';
      const myAd = ads.find((a) => selectedAdIds.has(a.id) && a.direction?.toUpperCase() === direction);
      if (!myAd) continue;

      const side = direction === 'BUY' ? 'Sell' : 'Buy';
      const marketAds = await fetchMarketAds(
        { side, asset: rule.asset ?? 'USDT', fiatCurrency: rule.fiat_currency ?? 'USD' },
        apiKey, apiSecret,
      ).catch((e) => { console.warn(`[Bot ${userId}] market fetch: ${e.message}`); return [] as any[]; });

      const ranking = computeRankings(marketAds, direction);

      // Save ranking snapshot
      await saveRanking(userId, {
        market_key: `${direction}_${rule.asset}_${rule.fiat_currency}`,
        direction, asset: rule.asset, fiat_currency: rule.fiat_currency,
        competitors: ranking.competitors.map((c) => ({ id: c.id, price: c.price })),
        first_ranked: ranking.first, second_ranked: ranking.second, third_ranked: ranking.third,
        last_refresh: new Date().toISOString(), data_stale: false,
      }).catch(() => {});

      if (!ranking.first) continue;

      const currentPrice = parsePrice(myAd.price ?? '0');
      const targetPrice = computeTargetPrice(currentPrice, parsePrice(String(ranking.first.price ?? '0')), rule);
      if (!targetPrice) continue; // price unchanged

      if (!rule.dry_run) {
        const result = await updateAdPrice(myAd.id, targetPrice, apiKey, apiSecret);
        if (result.success) {
          await addLog(userId, { level: 'success', category: 'pricing', message: `Updated ad ${myAd.id}: ${currentPrice}→${targetPrice}`, ad_id: myAd.id, previous_value: String(currentPrice), new_value: targetPrice }).catch(() => {});
        } else {
          await addLog(userId, { level: 'error', category: 'pricing', message: `Update failed ${myAd.id}: ${result.error}`, ad_id: myAd.id }).catch(() => {});
        }
      } else {
        await addLog(userId, { level: 'info', category: 'pricing', message: `[DRY] ${myAd.id}: ${currentPrice}→${targetPrice}`, ad_id: myAd.id }).catch(() => {});
      }
    }

    await updateBotState(userId, { status: 'running', last_successful_update: new Date().toISOString(), error_count: 0 }).catch(() => {});
  } catch (err: any) {
    console.error(`[Bot ${userId}]`, err.message);
    await addLog(userId, { level: 'error', category: 'bot', message: `Bot error: ${err.message}` }).catch(() => {});
    await updateBotState(userId, { status: 'error', message: err.message }).catch(() => {});
  }
}

// ── Master poll loop ──────────────────────────────────────────────────────────

async function pollAll() {
  try {
    const userIds = await getAllActiveUserIds(supabaseAdmin);
    await Promise.allSettled(userIds.map(processUser));
  } catch (err: any) {
    console.error('[Bot Worker] Poll failed:', err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initializeBotWorker(): void {
  if (timer) return;
  console.log(`[Bot Worker] Starting — interval: ${POLL_INTERVAL / 1000}s`);
  timer = setInterval(pollAll, POLL_INTERVAL);
  pollAll().catch((e) => console.error('[Bot Worker] Initial poll:', e.message));
}

export function stopBotWorker(): void {
  if (timer) { clearInterval(timer); timer = null; console.log('[Bot Worker] Stopped'); }
}
