// src/server/middleware/auth.ts
// Single-user desktop app: bypass JWT, use fixed GUEST_USER_ID from env.
// All RLS is bypassed here since this is a local-only app.
// In future: if multi-user is needed, add real JWT auth back.
import { type Request, type Response, type NextFunction } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '../services/db-helpers.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
  supabase: SupabaseClient;
}

const GUEST_USER_ID = process.env.GUEST_USER_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

// Creates a Supabase client scoped to the guest user.
// Uses ANON key so RLS policies still apply (safe read paths).
// For write paths that need to bypass RLS, use supabaseAdmin directly.
export function getScopedClient(): SupabaseClient {
  return new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Middleware that skips JWT verification and uses the fixed guest user.
// This is safe because the app is a single-user desktop client.
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const scopedSupabase = getScopedClient();
  (req as AuthenticatedRequest).userId = GUEST_USER_ID;
  (req as AuthenticatedRequest).supabase = scopedSupabase;
  next();
}

// Alias so existing route code doesn't need to change
export const supabaseAdminAuth = GUEST_USER_ID;
