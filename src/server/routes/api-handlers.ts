// src/server/routes/api-handlers.ts
// All authenticated API handler implementations.
// The owner access token is verified in middleware before these run.
// req.userId is always the bot owner's fixed UUID.
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase-db.js';
import {
  getCredMeta, getCredentialsForBot, getEnvCredentials, maskApiKey,
  saveCredentials, deleteCredentials,
} from '../services/supabase-db.js';
import {
  getSettings, saveSettings,
  getRules, saveRule, deleteRule,
  getAds, saveAds, updateAdSelected,
  getRankings, saveRanking,
  getLogs, clearLogs,
  getBotState, updateBotState,
} from '../services/db-helpers.js';
import { fetchMarketAds, getBybitAds, testBybitConnection, updateAdPrice } from '../services/bybit-api.js';
import { computeRankings, computeTargetPrice, parsePrice } from '../services/bot-algorithms.js';
import { claimPendingUpdate, getPendingUpdate, getPendingUpdates, releasePendingUpdate, removePendingUpdate } from '../services/pending-updates.js';

function ok(res: any, data: any) { res.json(data); }

function err(res: any, e: unknown, fallback = 'Request failed (500)') {
  const msg = e instanceof Error ? e.message : fallback;
  console.error('[API Error]', msg);
  const status = e instanceof Error && e.message.includes('required') ? 400 : 500;
  res.status(status).json({ error: msg });
}

function addClientAliases<T extends Record<string, any>>(
  row: T,
  aliases: Record<string, string>,
): T & Record<string, any> {
  const result: Record<string, any> = { ...row };
  for (const [clientName, databaseName] of Object.entries(aliases)) {
    result[clientName] = row[databaseName] ?? row[clientName];
  }
  return result as T & Record<string, any>;
}

function mapClientFields(
  value: Record<string, unknown>,
  aliases: Record<string, string>,
): Record<string, unknown> {
  const result = { ...value };
  for (const [clientName, databaseName] of Object.entries(aliases)) {
    if (clientName in result) {
      result[databaseName] = result[clientName];
      delete result[clientName];
    }
  }
  return result;
}

const settingAliases = {
  pollingIntervalMs: 'polling_interval_ms',
  launchAtLogin: 'launch_at_login',
  showNotifications: 'show_notifications',
  soundAlerts: 'sound_alerts',
};

const ruleAliases = {
  fiatCurrency: 'fiat_currency',
  fixedPrice: 'fixed_price',
  offsetAmount: 'offset_amount',
  offsetType: 'offset_type',
  minPrice: 'min_price',
  maxPrice: 'max_price',
  maxChangePercent: 'max_change_percent',
  minIntervalMs: 'min_interval_ms',
  maxUpdatesPerHour: 'max_updates_per_hour',
  maxUpdatesPerDay: 'max_updates_per_day',
  pricePrecision: 'price_precision',
  maxDeviationPercent: 'max_deviation_percent',
  manualApproval: 'manual_approval',
  dryRun: 'dry_run',
  paymentMethodIds: 'payment_method_ids',
  targetPosition: 'target_position',
  priceOffset: 'price_offset',
};

function ruleForClient(row: Record<string, any>) {
  return addClientAliases(row, ruleAliases);
}

function adForClient(row: Record<string, any>) {
  const ad = addClientAliases(row, {
    accountId: 'account_id',
    fiatCurrency: 'fiat_currency',
    availableQuantity: 'available_quantity',
    minAmount: 'min_order_amount',
    maxAmount: 'max_order_amount',
    paymentMethods: 'payment_methods',
    isSelected: 'is_selected',
    lastUpdateTime: 'last_update_time',
    createdTime: 'created_time',
  });
  if (row.ad_id) {
    ad.recordId = row.id;
    ad.id = row.ad_id;
  }
  return ad;
}

function rankingForClient(row: Record<string, any>) {
  return addClientAliases(row, {
    fiatCurrency: 'fiat_currency',
    firstRanked: 'first_ranked',
    secondRanked: 'second_ranked',
    thirdRanked: 'third_ranked',
    lastRefresh: 'last_refresh',
    dataStale: 'data_stale',
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function handleGetSettings(req: AuthenticatedRequest, res: any) {
  try {
    const settings = await getSettings(req.supabase, req.userId);
    ok(res, settings ? addClientAliases(settings, settingAliases) : {});
  }
  catch (e) { err(res, e, 'Failed to load settings'); }
}

export async function handleSaveSettings(req: AuthenticatedRequest, res: any) {
  try {
    const settings = mapClientFields(req.body ?? {}, settingAliases);
    const saved = await saveSettings(req.supabase, req.userId, settings);
    ok(res, addClientAliases(saved, settingAliases));
  }
  catch (e) { err(res, e, 'Failed to save settings'); }
}

// ── Credentials ───────────────────────────────────────────────────────────────

export async function handleGetCredentials(req: AuthenticatedRequest, res: any) {
  try {
    const credentials = await getCredMeta(req.userId);
    const envCredentials = getEnvCredentials();
    const usesEnvCredentials = !credentials?.has_credentials && Boolean(envCredentials);
    const response: Record<string, any> = credentials
      ? addClientAliases(credentials, { hasCredentials: 'has_credentials', apiKeyMasked: 'api_key_masked' })
      : { has_credentials: false, hasCredentials: false };
    if (usesEnvCredentials && envCredentials) {
      response.has_credentials = true;
      response.hasCredentials = true;
      response.api_key_masked = maskApiKey(envCredentials.apiKey);
      response.apiKeyMasked = response.api_key_masked;
    }
    ok(res, response);
  }
  catch (e) { err(res, e, 'Failed to load credentials'); }
}

export async function handleSaveCredentials(req: AuthenticatedRequest, res: any) {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'apiKey and apiSecret are required' });
  }
  try {
    const ip = (req.headers['x-forwarded-for'] as string ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim();
    await saveCredentials(req.userId, apiKey, apiSecret, ip);
    res.json({ success: true, message: 'Credentials saved successfully' });
  } catch (e) { err(res, e, 'Failed to save credentials'); }
}

export async function handleDeleteCredentials(req: AuthenticatedRequest, res: any) {
  try { await deleteCredentials(req.userId); ok(res, { message: 'Credentials deleted' }); }
  catch (e) { err(res, e, 'Failed to delete credentials'); }
}

export async function handleTestConnection(req: AuthenticatedRequest, res: any) {
  try {
    const { apiKey, apiSecret } = req.body ?? {};
    if (Boolean(apiKey) !== Boolean(apiSecret)) {
      return res.status(400).json({ error: 'apiKey and apiSecret must both be provided' });
    }
    const credentials = apiKey && apiSecret
      ? { apiKey, apiSecret }
      : await getCredentialsForBot(req.userId);
    if (!credentials) {
      return res.status(400).json({ error: 'Save Bybit API credentials before testing the connection' });
    }
    const result = await testBybitConnection(credentials.apiKey, credentials.apiSecret);
    res.json({
      success: result.success,
      apiKeyPrefix: result.apiKeyPrefix ?? '',
      error: result.error,
      errorCode: result.errorCode,
    });
  } catch (e) {
    err(res, e, 'Connection test failed');
  }
}

// ── Ads ────────────────────────────────────────────────────────────────────────

export async function handleGetAds(req: AuthenticatedRequest, res: any) {
  try { ok(res, (await getAds(req.supabase, req.userId)).map(adForClient)); }
  catch (e) { err(res, e, 'Failed to load ads'); }
}

export async function handleFetchAds(req: AuthenticatedRequest, res: any) {
  try {
    const { apiKey, apiSecret } = req.body ?? {};
    if (Boolean(apiKey) !== Boolean(apiSecret)) {
      return res.status(400).json({ error: 'apiKey and apiSecret must both be provided' });
    }
    const credentials = apiKey && apiSecret
      ? { apiKey, apiSecret }
      : await getCredentialsForBot(req.userId);
    if (!credentials) {
      return res.status(400).json({ error: 'Save Bybit API credentials before fetching ads' });
    }
    const ads = await getBybitAds(credentials);
    const selectedIds = new Set(
      (await getAds(req.supabase, req.userId))
        .filter((ad: any) => ad.is_selected)
        .map((ad: any) => String(ad.ad_id ?? ad.id)),
    );
    await saveAds(req.supabase, req.userId, ads.map((ad: any) => {
      const { updatePayload: _updatePayload, ...record } = ad;
      return { ...record, is_selected: selectedIds.has(String(ad.id)) };
    }));
    ok(res, { success: true, count: ads.length });
  } catch (e) { err(res, e, 'Failed to fetch ads'); }
}

export async function handleUpdateAdSelected(req: AuthenticatedRequest, res: any) {
  const { adId, selected } = req.body ?? {};
  if (!adId) return res.status(400).json({ error: 'adId is required' });
  try { await updateAdSelected(req.supabase, req.userId, adId, selected ?? false); ok(res, { success: true }); }
  catch (e) { err(res, e); }
}

// ── Rules ──────────────────────────────────────────────────────────────────────

export async function handleGetRules(req: AuthenticatedRequest, res: any) {
  try { ok(res, (await getRules(req.supabase, req.userId)).map(ruleForClient)); }
  catch (e) { err(res, e, 'Failed to load rules'); }
}

export async function handleSaveRule(req: AuthenticatedRequest, res: any) {
  try {
    const rule = mapClientFields(req.body ?? {}, ruleAliases);
    if (typeof rule.id === 'string' && rule.id.startsWith('r_')) {
      delete rule.id;
    }
    ok(res, ruleForClient(await saveRule(req.supabase, req.userId, rule)));
  }
  catch (e) { err(res, e, 'Failed to save rule'); }
}

export async function handleDeleteRule(req: AuthenticatedRequest, res: any) {
  try { await deleteRule(req.supabase, req.userId, String(req.params.id)); ok(res, { success: true }); }
  catch (e) { err(res, e, 'Failed to delete rule'); }
}

// ── Rankings ──────────────────────────────────────────────────────────────────

export async function handleGetRankings(req: AuthenticatedRequest, res: any) {
  try { ok(res, (await getRankings(req.supabase, req.userId)).map(rankingForClient)); }
  catch (e) { err(res, e, 'Failed to load rankings'); }
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function handleGetLogs(req: AuthenticatedRequest, res: any) {
  const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10), 1000);
  try { ok(res, await getLogs(req.supabase, req.userId, limit)); }
  catch (e) { err(res, e, 'Failed to load logs'); }
}

export async function handleClearLogs(req: AuthenticatedRequest, res: any) {
  try { await clearLogs(req.supabase, req.userId); ok(res, { success: true }); }
  catch (e) { err(res, e, 'Failed to clear logs'); }
}

// ── Bot State ─────────────────────────────────────────────────────────────────

export async function handleGetBotState(req: AuthenticatedRequest, res: any) {
  try {
    const state = await getBotState(req.supabase, req.userId);
    ok(res, state ? addClientAliases(state, {
      lastUpdate: 'last_update',
      lastSuccessfulUpdate: 'last_successful_update',
      currentIP: 'current_ip',
      lastWorkingIp: 'last_working_ip',
      errorCount: 'error_count',
      updateCount: 'update_count',
    }) : { status: 'stopped' });
  }
  catch (e) { err(res, e); }
}

export async function handleUpdateBotState(req: AuthenticatedRequest, res: any) {
  try {
    const state = await updateBotState(req.supabase, req.userId, req.body);
    if (req.body?.status === 'running') {
      const { wakeBotWorker } = await import('../services/bot-worker.js');
      wakeBotWorker();
    }
    ok(res, state);
  }
  catch (e) { err(res, e); }
}

export async function handleGetPendingUpdates(req: AuthenticatedRequest, res: any) {
  ok(res, getPendingUpdates(req.userId));
}

export async function handleRejectPendingUpdate(req: AuthenticatedRequest, res: any) {
  const removed = removePendingUpdate(req.userId, String(req.params.id));
  if (!removed) return res.status(404).json({ error: 'Pending update not found or expired' });
  ok(res, { success: true });
}

export async function handleApprovePendingUpdate(req: AuthenticatedRequest, res: any) {
  const pending = getPendingUpdate(req.userId, String(req.params.id));
  if (!pending) return res.status(404).json({ error: 'Pending update not found or expired' });
  if (!claimPendingUpdate(req.userId, pending.id)) {
    return res.status(409).json({ error: 'This pending update is already being processed' });
  }

  try {
    const state = await getBotState(req.supabase, req.userId);
    if (state?.status !== 'running') return res.status(409).json({ error: 'Start the bot before approving a price update' });

    const rules = await getRules(req.supabase, req.userId);
    const rule = rules.find((item: any) => item.id === pending.ruleId);
    if (!rule?.enabled || !rule.manual_approval || rule.dry_run) {
      removePendingUpdate(req.userId, pending.id);
      return res.status(409).json({ error: 'The rule changed; refresh the pending updates before approving' });
    }

    const credentials = await getCredentialsForBot(req.userId);
    if (!credentials) return res.status(400).json({ error: 'Save Bybit API credentials before approving an update' });

    const [cachedAds, ownAds] = await Promise.all([
      getAds(req.supabase, req.userId),
      getBybitAds(credentials),
    ]);
    const cachedAd = cachedAds.find((ad: any) => String(ad.ad_id ?? ad.id) === pending.adId && ad.is_selected);
    const myAd = ownAds.find((ad: any) => ad.id === pending.adId);
    const expectedDirection = String(rule.direction).toUpperCase();
    const isRuleMatch = myAd &&
      myAd.direction === expectedDirection &&
      String(myAd.asset).toUpperCase() === String(rule.asset ?? 'USDT').toUpperCase() &&
      String(myAd.fiat_currency).toUpperCase() === String(rule.fiat_currency ?? 'USD').toUpperCase();
    if (!cachedAd || !isRuleMatch || myAd.status !== 'online') {
      removePendingUpdate(req.userId, pending.id);
      return res.status(409).json({ error: 'The ad is no longer selected or online' });
    }

    const currentPrice = parsePrice(String(myAd.price));
    if (Math.abs(currentPrice - pending.currentPrice) > 1e-8) {
      removePendingUpdate(req.userId, pending.id);
      return res.status(409).json({ error: 'The ad price changed; refresh rankings and review the new target' });
    }

    const direction = String(rule.direction).toUpperCase() as 'BUY' | 'SELL';
    const marketAds = await fetchMarketAds({
      side: direction === 'BUY' ? 'Buy' : 'Sell',
      asset: String(rule.asset ?? 'USDT'),
      fiatCurrency: String(rule.fiat_currency ?? 'USD'),
      paymentMethodIds: rule.payment_method_ids,
    }, credentials.apiKey, credentials.apiSecret);
    const ownedIds = new Set(ownAds.map((ad: any) => ad.id));
    const ranking = computeRankings(marketAds.filter((ad: any) => !ownedIds.has(String(ad.id))), direction);
    const freshTarget = computeTargetPrice(currentPrice, ranking, rule);
    if (!freshTarget || Math.abs(Number(freshTarget) - Number(pending.targetPrice)) > 1e-8) {
      removePendingUpdate(req.userId, pending.id);
      return res.status(409).json({ error: 'The market target changed; refresh rankings and review the new target' });
    }

    const lastUpdate = Date.parse(String(myAd.last_update_time ?? ''));
    if (Number.isFinite(lastUpdate) && Number(rule.min_interval_ms) > 0 && Date.now() - lastUpdate < Number(rule.min_interval_ms)) {
      return res.status(409).json({ error: 'The minimum update interval has not elapsed' });
    }
    const hourCount = await countUpdatesForWorker(req.userId, pending.adId, Date.now() - 60 * 60 * 1000);
    const dayCount = await countUpdatesForWorker(req.userId, pending.adId, Date.now() - 24 * 60 * 60 * 1000);
    if (Number(rule.max_updates_per_hour) > 0 && hourCount >= Number(rule.max_updates_per_hour)) {
      return res.status(409).json({ error: 'The hourly update limit has been reached' });
    }
    if (Number(rule.max_updates_per_day) > 0 && dayCount >= Number(rule.max_updates_per_day)) {
      return res.status(409).json({ error: 'The daily update limit has been reached' });
    }

    const latestState = await getBotState(req.supabase, req.userId);
    if (latestState?.status !== 'running') {
      return res.status(409).json({ error: 'The bot was stopped or paused before approval completed' });
    }

    const result = await updateAdPrice(myAd, freshTarget, credentials.apiKey, credentials.apiSecret);
    if (!result.success) return res.status(502).json({ error: result.error || 'Bybit rejected the price update' });

    await updateAdForWorker(req.userId, pending.adId, freshTarget);
    await addLogForWorker(req.userId, {
      level: 'success', category: 'pricing',
      message: `Approved and updated ad ${pending.adId}: ${currentPrice} -> ${freshTarget}`,
      ad_id: pending.adId, previous_value: String(currentPrice), new_value: freshTarget,
    });
    await updateBotState(req.supabase, req.userId, {
      last_successful_update: new Date().toISOString(),
      update_count: Number(state.update_count ?? 0) + 1,
      error_count: 0,
    });
    removePendingUpdate(req.userId, pending.id);
    return ok(res, { success: true, adId: pending.adId, price: freshTarget });
  } catch (e) {
    err(res, e, 'Failed to approve the pending update');
  } finally {
    releasePendingUpdate(pending.id);
  }
}

// ── Bot worker helpers (use service role — no user context) ─────────────────────

/** Wraps getRules with supabaseAdmin for the bot worker's cross-user polling. */
export async function getRulesForWorker(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('pricing_rules').select('*').eq('user_id', userId).eq('enabled', true);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Returns the bot state used to gate worker activity. */
export async function getBotStateForWorker(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('bot_state')
    .select('status, update_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSettingsForWorker(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('bot_settings')
    .select('polling_interval_ms')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Wraps getAds with supabaseAdmin for the bot worker. */
export async function getAdsForWorker(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('ads').select('*').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function syncAdsForWorker(userId: string, ads: Record<string, unknown>[]) {
  const existing = await getAdsForWorker(userId);
  const selectedIds = new Set(
    existing.filter((ad: any) => ad.is_selected).map((ad: any) => String(ad.ad_id ?? ad.id)),
  );
  const rows = ads.map((ad: any) => {
    const { updatePayload: _updatePayload, ...record } = ad;
    return { ...record, is_selected: selectedIds.has(String(ad.id)) };
  });
  await saveAds(supabaseAdmin, userId, rows);
  return ads.map((ad: any) => ({ ...ad, is_selected: selectedIds.has(String(ad.id)) }));
}

/** Wraps saveRanking with supabaseAdmin for the bot worker. */
export async function saveRankingForWorker(userId: string, ranking: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from('competitor_rankings')
    .upsert({ ...ranking, user_id: userId }, { onConflict: 'user_id,market_key' });
  if (error) throw new Error(error.message);
}

/** Wraps addLog with supabaseAdmin for the bot worker. */
export async function addLogForWorker(userId: string, entry: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from('activity_logs').insert({ ...entry, user_id: userId });
  if (error) throw new Error(error.message);
}

/** Updates the cached ad after a successful Bybit price change. */
export async function updateAdForWorker(userId: string, adId: string, price: string) {
  const updatedAt = new Date().toISOString();
  const modern = await supabaseAdmin
    .from('ads')
    .update({ price, last_update_time: updatedAt })
    .eq('id', adId)
    .eq('user_id', userId)
    .select('id');
  if (modern.error && modern.error.code !== '22P02') throw new Error(modern.error.message);
  if (modern.data?.length) return;

  const legacy = await supabaseAdmin
    .from('ads')
    .update({ price, last_update_time: updatedAt })
    .eq('ad_id', adId)
    .eq('user_id', userId);
  if (legacy.error) throw new Error(legacy.error.message);
}

/** Counts successful price updates for an ad within the requested time window. */
export async function countUpdatesForWorker(userId: string, adId: string, since: number): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('activity_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ad_id', adId)
    .eq('category', 'pricing')
    .eq('level', 'success')
    .gte('created_at', new Date(since).toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Wraps updateBotState with supabaseAdmin for the bot worker. */
export async function updateBotStateForWorker(userId: string, state: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from('bot_state').upsert({ ...state, user_id: userId });
  if (error) throw new Error(error.message);
}
