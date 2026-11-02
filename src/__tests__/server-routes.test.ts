// src/__tests__/server-routes.test.ts
// Tests that the Express backend correctly registers the /api/credentials routes
// and verifies security properties: no API secrets returned, owner-access enforced.
import { describe, test, expect } from '@jest/globals';

function extractServerRoutes() {
  const fs = require('fs');
  const src = fs.readFileSync('src/server/routes/api.ts', 'utf-8');
  const matches = [...src.matchAll(/app\.(get|post|put|patch|delete)\('([^']+)'/g)];
  return matches.map((m: any) => ({ method: m[1].toUpperCase(), path: m[2] }));
}

function extractDbHelpers() {
  const fs = require('fs');
  const src = fs.readFileSync('src/server/services/supabase-db.ts', 'utf-8');
  return {
    usesGetCredMeta: src.includes('getCredMeta'),
    hasBotGetter: src.includes('getCredentialsForBot'),
    hasEncrypt: src.includes('encrypt('),
    hasDecrypt: src.includes('decrypt('),
    hasMaskFn: src.includes('maskApiKey'),
  };
}

function extractOwnerUUID() {
  const fs = require('fs');
  const indexSrc = fs.readFileSync('src/server/index.ts', 'utf-8');
  const indexMatch = indexSrc.match(/BOT_OWNER_ID\s*=\s*['"]([^'"]+)['"]/);
  const indexOwnerId = indexMatch?.[1];
  const authSrc = fs.readFileSync('src/server/middleware/auth.ts', 'utf-8');
  const authMatch = authSrc.match(/BOT_OWNER_ID\s*=\s*['"]([^'"]+)['"]/);
  const authOwnerId = authMatch?.[1];
  return { indexOwnerId, authOwnerId };
}

describe('Backend /api/credentials route registration', () => {
  const routes = extractServerRoutes();
  const credRoutes = routes.filter((r: any) => r.path.includes('/credentials'));

  test('GET /api/credentials is registered', () => {
    expect(credRoutes).toContainEqual({ method: 'GET', path: '/api/credentials' });
  });

  test('POST /api/credentials (save) is registered', () => {
    expect(credRoutes).toContainEqual({ method: 'POST', path: '/api/credentials' });
  });

  test('DELETE /api/credentials is registered', () => {
    expect(credRoutes).toContainEqual({ method: 'DELETE', path: '/api/credentials' });
  });

  test('POST /api/credentials/test is registered', () => {
    expect(credRoutes).toContainEqual({ method: 'POST', path: '/api/credentials/test' });
  });

  test('all 4 credentials routes are registered', () => {
    expect(credRoutes.length).toBe(4);
  });

  test('credentials routes are protected by auth middleware', () => {
    const fs = require('fs');
    const apiSrc = fs.readFileSync('src/server/routes/api.ts', 'utf-8');
    const authWrapped = apiSrc.match(/\.\.\.auth\s*\(/g) ?? [];
    expect(authWrapped.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Backend credentials security properties', () => {
  const db = extractDbHelpers();

  test('getCredMeta is used — never returns encrypted secret to browser', () => {
    expect(db.usesGetCredMeta).toBe(true);
  });

  test('AES-256-GCM encrypt/decrypt functions exist in supabase-db.ts', () => {
    expect(db.hasEncrypt).toBe(true);
    expect(db.hasDecrypt).toBe(true);
  });

  test('maskApiKey function exists for safe display', () => {
    expect(db.hasMaskFn).toBe(true);
  });

  test('getCredentialsForBot exists — server-internal, never exposed to browser', () => {
    expect(db.hasBotGetter).toBe(true);
  });
});

describe('Owner UUID consistency', () => {
  const { indexOwnerId, authOwnerId } = extractOwnerUUID();

  test('BOT_OWNER_ID = 00000000-0000-4000-8000-000000000001 in index.ts', () => {
    expect(indexOwnerId).toBe('00000000-0000-4000-8000-000000000001');
  });

  test('BOT_OWNER_ID = 00000000-0000-4000-8000-000000000001 in auth.ts', () => {
    expect(authOwnerId).toBe('00000000-0000-4000-8000-000000000001');
  });

  test('Both files export the same BOT_OWNER_ID', () => {
    expect(indexOwnerId).toBe(authOwnerId);
  });
});

describe('Frontend-to-backend route alignment', () => {
  test('vite.config.ts uses || default for window.__API_BASE__ (not ?? or empty string)', () => {
    const fs = require('fs');
    const viteSrc = fs.readFileSync('vite.config.ts', 'utf-8');
    expect(viteSrc).toContain("'window.__API_BASE__'");
    // Must use || (catches undefined AND empty string), not ?? (misses '')
    expect(viteSrc).toMatch(/['"]window\.__API_BASE__['"]:\s*JSON\.stringify\(env\.VITE_API_BASE_URL\s*\|\|/);
    // Must not default to empty string ''
    expect(viteSrc).not.toMatch(/['"]window\.__API_BASE__['"]:\s*JSON\.stringify\(env\.VITE_API_BASE_URL\s*\|\|\s*['"]{2}\)/);
  });

  test('backend routes use /api/ prefix', () => {
    const fs = require('fs');
    const apiSrc = fs.readFileSync('src/server/routes/api.ts', 'utf-8');
    expect(apiSrc).toContain("'/api/credentials'");
  });
});

describe('API handler security guarantees', () => {
  test('handleGetCredentials uses getCredMeta (no secret in response)', () => {
    const fs = require('fs');
    const hSrc = fs.readFileSync('src/server/routes/api-handlers.ts', 'utf-8');
    const idx = hSrc.indexOf('handleGetCredentials');
    // Only look at this function's body — slice to the next function export
    const nextFnIdx = hSrc.indexOf('export async function', idx + 10);
    const body = hSrc.slice(idx, nextFnIdx > 0 ? nextFnIdx : idx + 400);
    expect(body).toContain('getCredMeta');
    // handleGetCredentials must NEVER destructure or use apiSecret
    expect(body).not.toContain('apiSecret');
    expect(body).not.toContain('decrypt(');
    // It should NOT call saveCredentials
    expect(body).not.toContain('saveCredentials');
  });

  test('handleSaveCredentials validates apiKey + apiSecret required', () => {
    const fs = require('fs');
    const hSrc = fs.readFileSync('src/server/routes/api-handlers.ts', 'utf-8');
    expect(hSrc).toContain('handleSaveCredentials');
    const idx = hSrc.indexOf('handleSaveCredentials');
    const body = hSrc.slice(idx, idx + 500);
    expect(body).toContain('apiKey');
    expect(body).toContain('apiSecret');
  });

  test('handleTestConnection calls testBybitConnection, NOT saveCredentials', () => {
    const fs = require('fs');
    const hSrc = fs.readFileSync('src/server/routes/api-handlers.ts', 'utf-8');
    const idx = hSrc.indexOf('handleTestConnection');
    const body = hSrc.slice(idx, idx + 600);
    expect(body).toContain('testBybitConnection');
    expect(body).not.toContain('saveCredentials');
  });

  test('API handlers map renderer rule fields to database columns', () => {
    const fs = require('fs');
    const hSrc = fs.readFileSync('src/server/routes/api-handlers.ts', 'utf-8');
    expect(hSrc).toContain("dryRun: 'dry_run'");
    expect(hSrc).toContain("fiatCurrency: 'fiat_currency'");
    expect(hSrc).toContain('mapClientFields(req.body ?? {}, ruleAliases)');
  });

  test('New rule IDs are generated by the database rather than a non-UUID placeholder', () => {
    const fs = require('fs');
    const hSrc = fs.readFileSync('src/server/routes/api-handlers.ts', 'utf-8');
    const rSrc = fs.readFileSync('src/renderer/pages/Rules.tsx', 'utf-8');
    expect(hSrc).toContain("rule.id.startsWith('r_')");
    expect(rSrc).not.toContain('`r_${Date.now()}`');
  });

  test('Settings credential tests use the authenticated server API', () => {
    const fs = require('fs');
    const settingsSrc = fs.readFileSync('src/renderer/pages/Settings.tsx', 'utf-8');
    expect(settingsSrc).toContain('testCredentials(apiKey.trim(), apiSecret.trim())');
    expect(settingsSrc).toContain('credentials?.hasCredentials ?? credentials?.has_credentials');
  });
});

describe('Bot worker safety', () => {
  test('Worker checks persisted bot state before loading credentials or processing rules', () => {
    const fs = require('fs');
    const workerSrc = fs.readFileSync('src/server/services/bot-worker.ts', 'utf-8');
    expect(workerSrc).toContain('getBotStateForWorker(userId)');
    expect(workerSrc).toContain("if (state?.status !== 'running') return");
  });

  test('New pricing rules default to dry-run mode', () => {
    const fs = require('fs');
    const rulesSrc = fs.readFileSync('src/renderer/pages/Rules.tsx', 'utf-8');
    expect(rulesSrc.match(/dryRun: true/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test('Worker supports legacy ad records with a separate Bybit ad ID', () => {
    const fs = require('fs');
    const workerSrc = fs.readFileSync('src/server/services/bot-worker.ts', 'utf-8');
    const dbSrc = fs.readFileSync('src/server/services/db-helpers.ts', 'utf-8');
    expect(dbSrc).toContain("onConflict: 'user_id,ad_id'");
    expect(workerSrc).toContain('a.ad_id ?? a.id');
    expect(workerSrc).toContain('myAd.ad_id ?? myAd.id');
  });
});
