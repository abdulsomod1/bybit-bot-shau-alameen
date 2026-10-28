// src/renderer/lib/api-client.ts
// HTTP API client for the web/electron renderer.
// All requests go to the Express API server (same-origin in production).
// Owner access token is required for all endpoints (stored in localStorage).
const BASE = (window as any).__API_BASE__ ?? '/api';

/** Get the stored owner access token from localStorage */
export function getOwnerToken(): string {
  return localStorage.getItem('owner_access_token') ?? '';
}

/** Store the owner access token in localStorage */
export function setOwnerToken(token: string): void {
  if (token) localStorage.setItem('owner_access_token', token);
  else localStorage.removeItem('owner_access_token');
}

/** Clear the stored owner access token */
export function clearOwnerToken(): void {
  localStorage.removeItem('owner_access_token');
}

async function request<T>(
  method: string, path: string, body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Include the owner access token (required for all API endpoints)
  const token = getOwnerToken();
  if (token) headers['X-Owner-Access-Token'] = token;

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
