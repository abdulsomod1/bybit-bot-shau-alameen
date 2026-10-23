// src/server/services/db-helpers.ts
// All database helpers — uses the scoped supabase client from req.supabase
// (which has the user's JWT and respects RLS policies).
import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? '';

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('bot_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data;
}

export async function saveSettings(sb: SupabaseClient, userId: string, settings: Record<string, unknown>) {
  const { data, error } = await sb
    .from('bot_settings')
    .upsert({ ...settings, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(`saveSettings: ${error.message}`);
  return data;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export async function getRules(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('pricing_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveRule(sb: SupabaseClient, userId: string, rule: Record<string, unknown>) {
  const { data, error } = await sb
    .from('pricing_rules')
    .upsert({ ...rule, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRule(sb: SupabaseClient, userId: string, ruleId: string) {
  const { error } = await sb
    .from('pricing_rules')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ── Ads ───────────────────────────────────────────────────────────────────────

export async function getAds(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('ads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveAds(sb: SupabaseClient, userId: string, ads: Record<string, unknown>[]) {
  if (!ads.length) return;
  const rows = ads.map((ad) => ({ ...ad, user_id: userId }));
  const { error } = await sb
    .from('ads')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function updateAdSelected(sb: SupabaseClient, userId: string, adId: string, selected: boolean) {
  const { error } = await sb
    .from('ads')
    .update({ is_selected: selected })
    .eq('id', adId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ── Rankings ──────────────────────────────────────────────────────────────────

export async function getRankings(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('competitor_rankings')
    .select('*')
    .eq('user_id', userId)
    .order('market_key', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveRanking(sb: SupabaseClient, userId: string, ranking: Record<string, unknown>) {
  const { error } = await sb
    .from('competitor_rankings')
    .upsert({ ...ranking, user_id: userId }, { onConflict: 'user_id,market_key' });
  if (error) throw new Error(error.message);
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function getLogs(sb: SupabaseClient, userId: string, limit = 200) {
  const { data, error } = await sb
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addLog(
  sb: SupabaseClient,
  userId: string,
  entry: {
    level: string; category: string; message: string; details?: string;
    ad_id?: string; previous_value?: string; new_value?: string;
  },
) {
  const { error } = await sb
    .from('activity_logs')
    .insert({ ...entry, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function clearLogs(sb: SupabaseClient, userId: string) {
  const { error } = await sb
    .from('activity_logs')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ── Bot State ─────────────────────────────────────────────────────────────────

export async function getBotState(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('bot_state')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data ?? null;
}

export async function updateBotState(sb: SupabaseClient, userId: string, state: Record<string, unknown>) {
  const { data, error } = await sb
    .from('bot_state')
    .upsert({ ...state, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── User listing (for bot worker — uses service role) ─────────────────────────────

/** Returns all user IDs that have credentials set up. Used by the bot worker. */
export async function getAllActiveUserIds(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb
    .from('api_credentials')
    .select('user_id')
    .eq('has_credentials', true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.user_id);
}
