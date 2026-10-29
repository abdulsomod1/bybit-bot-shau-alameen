// src/__tests__/auth.test.ts
// Auth middleware security property tests.
import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';

function read(path) { return fs.readFileSync(path, 'utf-8'); }

describe('Timing-safe token comparison', () => {
  test('auth.ts imports timingSafeEqual from crypto', () => {
    const src = read('src/server/middleware/auth.ts');
    expect(src).toMatch(/import.*timingSafeEqual.*from\s+['"]crypto['"]/);
  });

  test('timingSafeStringEqual defined and uses crypto.timingSafeEqual', () => {
    const src = read('src/server/middleware/auth.ts');
    expect(src).toMatch(/function timingSafeStringEqual/);
    expect(src).toMatch(/timingSafeEqual\(/);
  });

  test('isValidOwnerToken uses timingSafeStringEqual not bare === for tokens', () => {
    const src = read('src/server/middleware/auth.ts');
    const fn = src.match(/function isValidOwnerToken[\s\S]*?(?=^\/|function\s|export)/m)?.[0] ?? '';
    expect(fn).toContain('timingSafeStringEqual');
    expect(fn).not.toMatch(/provided\s*===\s*OWNER_TOKEN/);
  });

  test('timingSafeStringEqual hashes on length mismatch (avoids timing leak)', () => {
    const src = read('src/server/middleware/auth.ts');
    expect(src).toContain('a.length !== b.length');
    expect(src).toContain('createHash');
  });

  test('Production requires OWNER_TOKEN_PROD non-empty before comparing', () => {
    const src = read('src/server/middleware/auth.ts');
    expect(src).toMatch(/OWNER_TOKEN_PROD\s*!==\s*['"]+['"]+\s*&&\s*timingSafeStringEqual/);
  });
});

describe('Auth 401 errors hide token', () => {
  test('Returns generic 401 message without token value', () => {
    const src = read('src/server/middleware/auth.ts');
    expect(src).toMatch(/status\(401\)\.json\(\{\s*error:\s*['"]Unauthorized: valid owner access token required['"]/);
  });

  test('Error string has no OWNER_TOKEN hint', () => {
    const src = read('src/server/middleware/auth.ts');
    const err = src.match(/status\(401\)\.json\([^}]+\}/)?.[0] ?? '';
    expect(err).not.toMatch(/OWNER_TOKEN|expected|should be/i);
  });
});

describe('Frontend-backend header consistency', () => {
  test('Backend reads x-owner-access-token header', () => {
    const src = read('src/server/middleware/auth.ts');
    expect(src).toMatch(/req\.headers\[['\"]x-owner-access-token['\"]/);
  });

  test('Frontend sends X-Owner-Access-Token header', () => {
    const src = read('src/renderer/lib/api-client.ts');
    expect(src).toMatch(/['\"]X-Owner-Access-Token['\"]/);
  });
});

describe('Token storage security', () => {
  test('Token in localStorage (not sessionStorage or URL)', () => {
    const src = read('src/renderer/lib/api-client.ts');
    expect(src).toMatch(/localStorage\.setItem\(['"]owner_access_token/);
    expect(src).not.toMatch(/sessionStorage/);
  });

  test('No owner access token logged to console in src/', () => {
    // The secret owner access token must never appear in console.log/debug.
    // Note: internal server logs may mention "owner" in non-secret contexts
    // (e.g. "owner user record", "owner: BOT_OWNER_ID UUID) which is fine
    // since the owner ID is a public database relationship key, not a secret.
    // We scan for the secret token variable name and the actual localStorage key.
    const scan = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = dir + '/' + e.name;
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist') {
          if (scan(p)) return true;
        } else if ((e.name.endsWith('.ts') || e.name.endsWith('.tsx')) && !dir.includes('__tests__')) {
          const c = fs.readFileSync(p, 'utf-8');
          // Check for the secret token variable being logged (the actual secret)
          const patterns = [
            /console\.(log|debug)\s*\([^)]*OWNER_ACCESS_TOKEN[^)]*/i,
            /console\.(log|debug)\s*\([^)]*owner_access_token[^)]*/i,
            // Check for the localStorage token value being logged
            /console\.(log|debug)\s*\([^)]*localStorage[^)]*owner/i,
          ];
          for (const pat of patterns) {
            if (pat.test(c)) return true;
          }
        }
      }
      return false;
    };
    expect(scan('src')).toBe(false);
  });

  test('No hardcoded token fallback in getOwnerToken', () => {
    const src = read('src/renderer/lib/api-client.ts');
    expect(src).toMatch(/localStorage\.getItem\(['"]owner_access_token/);
    expect(src).not.toMatch(/getOwnerToken\s*\(\)\s*\|\|/);
  });
});

describe('All endpoints use auth middleware', () => {
  test('Every /api/ route uses auth() wrapper', () => {
    const src = read('src/server/routes/api.ts');
    const wrapped = src.match(/\.\.\.auth\s*\(/g) ?? [];
    const routes = [...src.matchAll(/app\.(get|post|put|patch|delete)\s*\(\s*['\"][^'\"]+['\"]/g)];
    expect(wrapped.length).toBe(routes.length);
  });

  test('BOT_OWNER_ID consistent between auth.ts and index.ts', () => {
    const auth = read('src/server/middleware/auth.ts');
    const idx = read('src/server/index.ts');
    const aId = auth.match(/BOT_OWNER_ID\s*=\s*['"]([^'"]+)['"]/)?.[1];
    const iId = idx.match(/BOT_OWNER_ID\s*=\s*['"]([^'"]+)['"]/)?.[1];
    expect(aId).toBe(iId);
    expect(aId).toBe('00000000-0000-4000-8000-000000000001');
  });
});

describe('Environment variable names', () => {
  test('auth.ts reads OWNER_ACCESS_TOKEN and OWNER_ACCESS_TOKEN_DEV', () => {
    const src = read('src/server/middleware/auth.ts');
    expect(src).toMatch(/process\.env\.OWNER_ACCESS_TOKEN/);
    expect(src).toMatch(/process\.env\.OWNER_ACCESS_TOKEN_DEV/);
  });

  test('render.yaml uses OWNER_ACCESS_TOKEN (not another name)', () => {
    const src = read('render.yaml');
    expect(src).toMatch(/key:\s*OWNER_ACCESS_TOKEN/);
    expect(src).not.toMatch(/key:\s*OWNER_TOKEN\b/);
  });

  test('render.yaml marks OWNER_ACCESS_TOKEN as REQUIRED', () => {
    const src = read('render.yaml');
    expect(src).toMatch(/OWNER_ACCESS_TOKEN.*REQUIRED|REQUIRED.*OWNER_ACCESS_TOKEN/s);
  });
});
