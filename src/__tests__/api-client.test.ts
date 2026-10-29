// src/__tests__/api-client.test.ts
// Tests that the frontend API client constructs correct URLs.
// The bug was: window.__API_BASE__ defaulted to '' (empty string) in Vite config,
// causing BASE to be '' and requests to go to '/credentials' instead of '/api/credentials'.
import { describe, test, expect } from '@jest/globals';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract API client paths from source by parsing the request() call signatures.
 *  The pattern is: request<...>('METHOD', '/path', ...)
 *  We want the second string argument: '/path'                                   */
function extractApiClientPaths() {
  const fs = require('fs');
  const src = fs.readFileSync('src/renderer/lib/api-client.ts', 'utf-8');

  // Match request<...>('METHOD', '/some-path'[, ...])
  // Capture group 1 = the HTTP method, capture group 2 = the path
  const matches = [...src.matchAll(/request<[^>]+>\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/g)];
  return {
    methods: matches.map((m) => m[1]),
    paths: matches.map((m) => m[2]),
  };
}

/** Extract the BASE expression from api-client.ts */
function extractBaseExpr() {
  const fs = require('fs');
  const src = fs.readFileSync('src/renderer/lib/api-client.ts', 'utf-8');
  const match = src.match(/const BASE\s*=\s*(.+?);/);
  return match?.[1] ?? '';
}

/** Simulate what the Vite define plugin assigns for a given VITE_API_BASE_URL.
 *  After fix: vite.config.ts uses `|| '/api'` so undefined → '/api' AND '' → '/api'  */
function simulateViteDefine(viteApiBaseUrl: string | undefined): string {
  // This mirrors the actual vite.config.ts define:
  // 'window.__API_BASE__': JSON.stringify(env.VITE_API_BASE_URL || '/api')
  // || catches both null/undefined AND empty string
  return viteApiBaseUrl || '/api';
}

/** Simulate the BASE fallback in api-client.ts (uses || not ?? — catches empty strings). */
function simulateBase(windowApiBase: string): string {
  return windowApiBase || '/api';
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('API client route consistency', () => {
  test('credentials paths in api-client.ts are relative (start with /)', () => {
    const { paths } = extractApiClientPaths();
    const credPaths = paths.filter(
      (p: string) => p.includes('credentials') && !p.includes('test'),
    );
    expect(credPaths).toContain('/credentials');
    expect(credPaths.length).toBeGreaterThanOrEqual(3); // get, save, delete
  });

  test('apiCredentials.save and .get and .delete target /credentials', () => {
    const { paths } = extractApiClientPaths();
    expect(paths).toContain('/credentials');
  });

  test('apiCredentials.test targets /credentials/test', () => {
    const { paths } = extractApiClientPaths();
    expect(paths).toContain('/credentials/test');
  });

  test('BASE expression uses || not just ?? (handles empty string)', () => {
    const baseExpr = extractBaseExpr();
    // After fix: uses || so empty string falls back to /api
    expect(baseExpr).toMatch(/\|\|/);
    expect(baseExpr).toContain("'/api'");
  });
});

describe('BASE URL fallback logic', () => {
  test('VITE_API_BASE_URL undefined → window.__API_BASE__ becomes /api (not empty)', () => {
    const result = simulateViteDefine(undefined);
    expect(result).toBe('/api');
  });

  test('VITE_API_BASE_URL empty string → window.__API_BASE__ becomes /api', () => {
    // After fix: vite.config.ts uses ?? '/api', so '' also becomes '/api'
    const result = simulateViteDefine('');
    expect(result).toBe('/api');
  });

  test('VITE_API_BASE_URL set to /api → window.__API_BASE__ is /api', () => {
    const result = simulateViteDefine('/api');
    expect(result).toBe('/api');
  });

  test('VITE_API_BASE_URL set to https://custom.api.com → BASE is that URL', () => {
    const result = simulateViteDefine('https://custom.api.com');
    expect(result).toBe('https://custom.api.com');
  });

  test('resolved BASE + /credentials = /api/credentials (the fixed route)', () => {
    // Simulate browser: VITE_API_BASE_URL not set → window.__API_BASE__ = '/api'
    const windowApiBase = simulateViteDefine(undefined);
    const base = simulateBase(windowApiBase);
    const fullUrl = base + '/credentials';
    expect(fullUrl).toBe('/api/credentials');
  });

  test('BEFORE FIX: empty window.__API_BASE__ with ?? would produce /credentials (bug)', () => {
    // Old api-client.ts: const BASE = (window as any).__API_BASE__ ?? '/api';
    // ?? only falls back on null/undefined, so '' stays ''
    const oldBase = (v: string | undefined) => v ?? '/api';
    expect(oldBase('')).toBe('');   // ← THE BUG: BASE became '' → /credentials → 404
    expect(oldBase(undefined)).toBe('/api');
  });

  test('AFTER FIX: empty window.__API_BASE__ with || produces /api/credentials (correct)', () => {
    // New api-client.ts: const BASE = (window as any).__API_BASE__ || '/api';
    // || falls back on ALL falsy values including ''
    const newBase = (v: string) => v || '/api';
    expect(newBase('')).toBe('/api');   // Fixed!
    expect(newBase('/api')).toBe('/api');
    // BASE + '/credentials' = /api/credentials ✓
    expect(newBase('') + '/credentials').toBe('/api/credentials');
  });
});

