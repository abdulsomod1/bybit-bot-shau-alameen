// src/server/index.ts — Express API server + static file serving
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from './services/supabase-db.js';
import { registerApiRoutes } from './routes/api.js';
import { initializeBotWorker } from './services/bot-worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const GUEST_USER_ID = process.env.GUEST_USER_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ── Bootstrap: ensure guest user rows exist ────────────────────────────────────
async function ensureGuestRows() {
  console.log('[Bootstrap] Trying to create guest user rows...');

  // FIRST: ensure the guest user exists in public.users (NOT auth.users)
  const userResult = await supabaseAdmin.from('users').upsert(
    { id: GUEST_USER_ID, email: 'guest@local.app', name: 'Local Guest' },
    { onConflict: 'id' }
  );
  if (userResult.error) {
    console.error('[Bootstrap] users:', userResult.error.message);
  } else {
    console.log('[Bootstrap] users: OK');
  }

  const tables = ['profiles', 'bot_settings', 'bot_state', 'api_credentials'];
  for (const table of tables) {
    try {
      const result = await supabaseAdmin.from(table).upsert(
        table === 'bot_state' ? { user_id: GUEST_USER_ID, status: 'stopped' } :
        table === 'profiles'  ? { id: GUEST_USER_ID, display_name: 'Local Guest' } :
                                { user_id: GUEST_USER_ID },
        { onConflict: table === 'profiles' ? 'id' : 'user_id', ignoreDuplicates: true }
      );
      if (result.error) {
        console.error(`[Bootstrap] ${table}:`, result.error.message);
      } else {
        console.log(`[Bootstrap] ${table}: OK`);
      }
    } catch (err: any) {
      console.error(`[Bootstrap] ${table} ERROR:`, err.message);
    }
  }
}

// ── App setup ──────────────────────────────────────────────────────────────
const app = express();

// Standard middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS — allow the React frontend origin in dev, restrict in prod
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const allowed = IS_PROD
    ? ['https://bybit-p2p-api.onrender.com'] // replace with your Render URL
    : ['http://localhost:5173', 'http://localhost:4173'];
  if (!origin || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Debug endpoint ──────────────────────────────────────────────────────────
app.get('/debug', async (_req: Request, res: Response) => {
  const debug: Record<string, any> = {
    timestamp: new Date().toISOString(),
    supabaseUrl: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    guestUserId: GUEST_USER_ID,
    tables: {} as Record<string, any>,
  };

  const tables = ['bot_settings', 'bot_state', 'api_credentials', 'pricing_rules', 'ads', 'activity_logs', 'competitor_rankings'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabaseAdmin.from(table).select('id').limit(1);
      debug.tables[table] = error ? { status: 'ERROR', message: error.message } : { status: 'OK', count: data?.length };
    } catch (err: any) {
      debug.tables[table] = { status: 'EXCEPTION', message: err.message };
    }
  }

  res.json(debug);
});

// ── Static files (served by Express in production) ──────────────────────────
// In dev: Vite's dev server serves the renderer.
// In prod: Express serves the built React app.
if (IS_PROD) {
  const rendererDist = path.resolve(__dirname, '../../dist/renderer');
  app.use(express.static(rendererDist));
}

// ── API Routes ──────────────────────────────────────────────────────────────
registerApiRoutes(app);

// ── SPA fallback ────────────────────────────────────────────────────────────
if (IS_PROD) {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, '../../dist/renderer/index.html'));
  });
}

// ── Global error handler ────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n🚀 Bybit P2P API server running on port ${PORT}`);
  console.log(`   Mode: ${IS_PROD ? 'production' : 'development'}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Debug:  http://localhost:${PORT}/debug\n`);

  // Bootstrap guest user rows (auto-creates if not exist)
  await ensureGuestRows().catch((e) => console.error('[Bootstrap] FATAL:', e.message));

  // Start the bot worker
  initializeBotWorker();
});

export { app };
