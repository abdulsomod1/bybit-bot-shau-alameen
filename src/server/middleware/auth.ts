// src/server/middleware/auth.ts
// Owner-only access middleware.
// The dashboard and all sensitive API routes require a valid owner access token.
// No Supabase Auth, no sign-up, no sign-in.
import { type Request, type Response, type NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

// ── Fixed bot owner UUID ───────────────────────────────────────────────────────
/** The fixed UUID of the bot owner. Used for all DB records. */
export const BOT_OWNER_ID = '00000000-0000-4000-8000-000000000001';

export interface AuthenticatedRequest extends Request {
  userId: string;
  supabase: SupabaseClient;
}

// ── Owner Access Token ─────────────────────────────────────────────────────────
// Protects sensitive routes from unauthorized public access.
const OWNER_TOKEN_PROD = process.env.OWNER_ACCESS_TOKEN ?? '';
const OWNER_TOKEN_DEV = process.env.OWNER_ACCESS_TOKEN_DEV ?? '';
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Compare two strings in constant time to prevent timing attacks.
 * Uses SHA-256 hashing first so both inputs are the same byte length
 * (required for timingSafeEqual), then compares using crypto.timingSafeEqual.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still perform work to avoid leaking length via timing.
    // Hash both strings (SHA-256 produces 32-byte output) so the
    // comparison is always on equal-length buffers.
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    try {
      return timingSafeEqual(ha, hb);
    } catch {
      // timingSafeEqual throws if buffers are different lengths;
      // in this branch lengths differ (ha/hb are both 32 bytes)
      // but the outer length check handled that — fall through to false.
      return false;
    }
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function isValidOwnerToken(req: Request): boolean {
  const provided = req.headers['x-owner-access-token'] as string | undefined;
  if (!provided) return false;

  if (IS_PROD) {
    // Production: only accept the single configured token (if set)
    return OWNER_TOKEN_PROD !== '' && timingSafeStringEqual(provided, OWNER_TOKEN_PROD);
  }
  // Development: accept either configured token
  return (
    (OWNER_TOKEN_DEV !== '' && timingSafeStringEqual(provided, OWNER_TOKEN_DEV)) ||
    (OWNER_TOKEN_PROD !== '' && timingSafeStringEqual(provided, OWNER_TOKEN_PROD))
  );
}

// ── Middleware ─────────────────────────────────────────────────────────────────

/**
 * Require owner access token for sensitive routes.
 * Returns 401 if token is missing or invalid.
 */
export function requireOwnerToken(req: Request, res: Response, next: NextFunction): void {
  if (!isValidOwnerToken(req)) {
    res.status(401).json({ error: 'Unauthorized: valid owner access token required' });
    return;
  }
  next();
}

/**
 * Set the bot owner userId on all requests (no JWT verification needed).
 * The owner ID is for database relationships, not authentication.
 */
export async function requireAuth(req: Request, _res: Response, _next: NextFunction): Promise<void> {
  (req as AuthenticatedRequest).userId = BOT_OWNER_ID;
  _next();
}

// Alias for compatibility with existing route code
export const supabaseAdminAuth = BOT_OWNER_ID;

