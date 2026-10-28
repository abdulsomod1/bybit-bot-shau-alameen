// src/server/middleware/auth.ts
// Owner-only access middleware.
// The dashboard and all sensitive API routes require a valid owner access token.
// No Supabase Auth, no sign-up, no sign-in.
import { type Request, type Response, type NextFunction } from 'express';
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

function isValidOwnerToken(req: Request): boolean {
  const provided = req.headers['x-owner-access-token'] as string | undefined;
  if (!provided) return false;
  if (IS_PROD) return provided === OWNER_TOKEN_PROD && OWNER_TOKEN_PROD !== '';
  return provided === OWNER_TOKEN_DEV || provided === OWNER_TOKEN_PROD;
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

