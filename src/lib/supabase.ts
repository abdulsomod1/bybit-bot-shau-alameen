// src/lib/supabase.ts
// Browser Supabase client — used for Auth only in this app.
// All data access goes through the Express API (JWT-authenticated).
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example → .env and fill in your Supabase project values.',
  );
}

/** Browser Supabase client for authentication (email/password). */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'bybit-p2p-auth',
    autoRefreshToken: true,
  },
});
