// src/server/services/supabase-db.ts
// Core: Supabase clients + AES-256-GCM encryption + credential helpers.
// Heavy RLS-aware query helpers live in db-helpers.ts.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ── Clients ─────────────────────────────────────────────────────────────────

/** Service-role client — server-side only, bypasses RLS. */
export const supabaseAdmin: SupabaseClient = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ── Encryption helpers ───────────────────────────────────────────────────────

function getKey(): Buffer {
  const k = process.env.RENDER_SERVICE_ENCRYPTION_KEY;
  const REQUIRED_LENGTH = 64;
  
  if (!k) {
    throw new Error(
      'RENDER_SERVICE_ENCRYPTION_KEY is missing. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  
  if (k.length !== REQUIRED_LENGTH) {
    throw new Error(
      `RENDER_SERVICE_ENCRYPTION_KEY must be ${REQUIRED_LENGTH} hex chars (you provided ${k.length}). ` +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  
  // Validate that it's valid hex
  if (!/^[a-fA-F0-9]+$/.test(k)) {
    throw new Error(
      'RENDER_SERVICE_ENCRYPTION_KEY must contain only hexadecimal characters (a-f, A-F, 0-9). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  
  return Buffer.from(k, 'hex');
}

/** Encrypts plaintext with AES-256-GCM. Returns base64(IV || authTag || ciphertext). */
export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: Buffer.concat([iv, authTag, enc]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

/** Decrypts base64(IV || authTag || ciphertext) back to plaintext. */
export function decrypt(encrypted: string, iv: string): string {
  const key = getKey();
  const combined = Buffer.from(encrypted, 'base64');
  const ivBuf = Buffer.from(iv, 'base64');
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Masks a Bybit API key for safe display (e.g. "abcd****1234"). */
export function maskApiKey(key: string): string {
  return key.length >= 8 ? `${key.slice(0, 4)}****${key.slice(-4)}` : '****';
}

// ── Auth helpers ─────────────────────────────────────────────────────────────────

/** Create a new user account. */
export async function signUp(email: string, password: string, displayName?: string) {
  const meta: Record<string, string> = {};
  if (displayName) meta.display_name = displayName;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('User creation returned no data');
  return data.user;
}

/** Sign in and return the session (contains access_token for JWT auth). */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('Login returned no session');
  return data;
}

// ── Credential helpers (service role, no RLS) ────────────────────────────────

/** Get credentials metadata only (no secret). Used by API route for display. */
export async function getCredMeta(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('api_credentials')
    .select('api_key_masked, has_credentials, registered_ip, created_at, updated_at')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data ?? null;
}

/** Save encrypted credentials. Used by API route on credential save. */
export async function saveCredentials(
  userId: string,
  apiKey: string,
  apiSecret: string,
  registeredIp: string,
) {
  const { encrypted, iv } = encrypt(apiSecret);
  const masked = maskApiKey(apiKey);

  // Check if credentials row already exists
  const { data: existing } = await supabaseAdmin
    .from('api_credentials')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Update existing credentials
    const { error } = await supabaseAdmin
      .from('api_credentials')
      .update({
        api_key: apiKey,
        api_key_masked: masked,
        api_secret_encrypted: encrypted,
        api_secret_iv: iv,
        has_credentials: true,
        registered_ip: registeredIp,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw new Error(`saveCredentials update: ${error.message}`);
  } else {
    // Insert new credentials
    const { error } = await supabaseAdmin
      .from('api_credentials')
      .insert({
        user_id: userId,
        api_key: apiKey,
        api_key_masked: masked,
        api_secret_encrypted: encrypted,
        api_secret_iv: iv,
        has_credentials: true,
        registered_ip: registeredIp,
      });
    if (error && error.code !== '23505') {
      throw new Error(`saveCredentials insert: ${error.message}`);
    }
  }
}

/** Delete credentials. Used by API route. */
export async function deleteCredentials(userId: string) {
  const { error } = await supabaseAdmin
    .from('api_credentials')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(`deleteCredentials: ${error.message}`);
}

/** Get raw credentials for bot worker (server-internal, never exposed to browser). */
export async function getCredentialsForBot(userId: string): Promise<{ apiKey: string; apiSecret: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('api_credentials')
    .select('api_key, api_secret_encrypted, api_secret_iv, has_credentials')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  if (!data.has_credentials || !data.api_secret_encrypted || !data.api_secret_iv) return null;
  try {
    return { apiKey: data.api_key ?? '', apiSecret: decrypt(data.api_secret_encrypted, data.api_secret_iv) };
  } catch {
    throw new Error('Failed to decrypt API secret. Check RENDER_SERVICE_ENCRYPTION_KEY.');
  }
}
