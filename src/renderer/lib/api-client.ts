// src/renderer/lib/api-client.ts
// HTTP API client — single-user desktop app, no JWT needed.
// All calls go to the local/remote Express API server.
const BASE = '/api';

async function request<T>(
  method: string, path: string, body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export const apiSettings = {
  get: () => request<any>('GET', '/settings'),
  save: (settings: Record<string, unknown>) => request<any>('POST', '/settings', settings),
};

// ── Credentials ───────────────────────────────────────────────────────────────

export const apiCredentials = {
  get: () => request<any>('GET', '/credentials'),
  save: (apiKey: string, apiSecret: string) =>
    request<any>('POST', '/credentials', { apiKey, apiSecret }),
  delete: () => request<any>('DELETE', '/credentials'),
  test: (apiKey: string, apiSecret: string) =>
    request<any>('POST', '/credentials/test', { apiKey, apiSecret }),
};

// ── Ads ───────────────────────────────────────────────────────────────────────

export const apiAds = {
  get: () => request<any[]>('GET', '/ads'),
  fetch: (apiKey: string, apiSecret: string) =>
    request<any>('POST', '/ads/fetch', { apiKey, apiSecret }),
  select: (adId: string, selected: boolean) =>
    request<any>('POST', '/ads/select', { adId, selected }),
};

// ── Rules ─────────────────────────────────────────────────────────────────────

export const apiRules = {
  get: () => request<any[]>('GET', '/rules'),
  save: (rule: Record<string, unknown>) => request<any>('POST', '/rules', rule),
  delete: (id: string) => request<any>('DELETE', `/rules/${id}`),
};

// ── Rankings ──────────────────────────────────────────────────────────────────

export const apiRankings = {
  get: () => request<any[]>('GET', '/rankings'),
};

// ── Logs ──────────────────────────────────────────────────────────────────────

export const apiLogs = {
  get: (limit = 200) => request<any[]>(`GET`, `/logs?limit=${limit}`),
  clear: () => request<any>('DELETE', '/logs'),
};

// ── Bot State ─────────────────────────────────────────────────────────────────

export const apiBotState = {
  get: () => request<any>('GET', '/bot-state'),
  update: (state: Record<string, unknown>) => request<any>('POST', '/bot-state', state),
};
