// src/server/routes/api-handlers.ts
// All authenticated API handler implementations.
// The owner access token is verified in middleware before these run.
// req.userId is always the bot owner's fixed UUID.
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase-db.js';
import { getCredMeta, saveCredentials, deleteCredentials } from '../services/supabase-db.js';
import {
  getSettings, saveSettings,
  getRules, saveRule, deleteRule,
  getAds, saveAds, updateAdSelected,
  getRankings, saveRanking,
  getLogs, clearLogs,
  getBotState, updateBotState,
} from '../services/db-helpers.js';
import { getBybitAds, testBybitConnection } from '../services/bybit-api.js';

function ok(res: any, data: any) { res.json(data); }

function err(res: any, e: unknown, fallback = 'Request failed (500)') {
  const msg = e instanceof Error ? e.message : fallback;
  console.error('[API Error]', msg);
  const status = e instanceof Error && e.message.includes('required') ? 400 : 500;
  res.status(status).json({ error: msg });
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function handleGetSettings(req: AuthenticatedRequest, res: any) {
  try { ok(res, await getSettings(req.supabase, req.userId) ?? {}); }
  catch (e) { err(res, e, 'Failed to load settings'); }
}

export async function handleSaveSettings(req: AuthenticatedRequest, res: any) {
  try { ok(res, await saveSettings(req.supabase, req.userId, req.body)); }
  catch (e) { err(res, e, 'Failed to save settings'); }
}

// ── Credentials ───────────────────────────────────────────────────────────────

export async function handleGetCredentials(req: AuthenticatedRequest, res: any) {
  try { ok(res, await getCredMeta(req.userId) ?? { has_credentials: false }); }
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
    res.json({ message: 'Credentials saved successfully' });
  } catch (e) { err(res, e, 'Failed to save credentials'); }
}

export async function handleDeleteCredentials(req: AuthenticatedRequest, res: any) {
  try { await deleteCredentials(req.userId); ok(res, { message: 'Credentials deleted' }); }
  catch (e) { err(res, e, 'Failed to delete credentials'); }
}

export async function handleTestConnection(req: AuthenticatedRequest, res: any) {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'apiKey and apiSecret are required' });
  }
  try {
    const result = await testBybitConnection(apiKey, apiSecret);
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
  try { ok(res, await getAds(req.supabase, req.userId)); }
  catch (e) { err(res, e, 'Failed to load ads'); }
}

export async function handleFetchAds(req: AuthenticatedRequest, res: any) {
  const { apiKey, apiSecret } = req.body ?? {};
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'apiKey and apiSecret required' });
  }
  try {
    const ads = await getBybitAds({ apiKey, apiSecret });
    await saveAds(req.supabase, req.userId, ads);
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
  try { ok(res, await getRules(req.supabase, req.userId)); }
  catch (e) { err(res, e, 'Failed to load rules'); }
}

export async function handleSaveRule(req: AuthenticatedRequest, res: any) {
  try { ok(res, await saveRule(req.supabase, req.userId, req.body)); }
  catch (e) { err(res, e, 'Failed to save rule'); }
}

export async function handleDeleteRule(req: AuthenticatedRequest, res: any) {
  try { await deleteRule(req.supabase, req.userId, String(req.params.id)); ok(res, { success: true }); }
  catch (e) { err(res, e, 'Failed to delete rule'); }
}

// ── Rankings ──────────────────────────────────────────────────────────────────

export async function handleGetRankings(req: AuthenticatedRequest, res: any) {
  try { ok(res, await getRankings(req.supabase, req.userId)); }
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
  try { ok(res, await getBotState(req.supabase, req.userId) ?? { status: 'stopped' }); }
  catch (e) { err(res, e); }
}

export async function handleUpdateBotState(req: AuthenticatedRequest, res: any) {
  try { ok(res, await updateBotState(req.supabase, req.userId, req.body)); }
  catch (e) { err(res, e); }
}

// ── Bot worker helpers (use service role — no user context) ─────────────────────

/** Wraps getRules with supabaseAdmin for the bot worker's cross-user polling. */
export async function getRulesForWorker(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('pricing_rules').select('*').eq('user_id', userId).eq('enabled', true);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Wraps getAds with supabaseAdmin for the bot worker. */
export async function getAdsForWorker(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('ads').select('*').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return data ?? [];
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

/** Wraps updateBotState with supabaseAdmin for the bot worker. */
export async function updateBotStateForWorker(userId: string, state: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from('bot_state').upsert({ ...state, user_id: userId });
  if (error) throw new Error(error.message);
}
