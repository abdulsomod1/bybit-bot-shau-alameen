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

// ── Fixed bot owner UUID (matches the DB owner record) ─────────────────────────
const BOT_OWNER_ID = '00000000-0000-4000-8000-000000000001';

// ── Bootstrap: ensure owner rows exist ──────────────────────────────────────────
async function ensureOwnerRows() {
  console.log('[Bootstrap] Ensuring owner user record...');

  // Ensure the owner user exists in public.users (created with correct UUID)
  const userResult = await supabaseAdmin.from('users').upsert(
    { id: BOT_OWNER_ID, email: 'bot@owner.local', name: 'Bot Owner' },
    { onConflict: 'id' }
  );
  if (userResult.error) {
    console.error('[Bootstrap] users upsert:', userResult.error.message);
  } else {
    console.log('[Bootstrap] users: OK');
  }

  // Ensure all owner-related rows exist — each table uses the correct onConflict target
  const tables: Array<{ name: string; data: Record<string, unknown>; conflictCol: string }> = [
    {
      name: 'profiles',
      data: { id: BOT_OWNER_ID, display_name: 'Bot Owner' },
      conflictCol: 'id',
    },
    {
      name: 'bot_settings',
      data: { user_id: BOT_OWNER_ID, polling_interval_ms: 60000, theme: 'dark' },
      conflictCol: 'user_id',
    },
    {
      name: 'bot_state',
      data: { user_id: BOT_OWNER_ID, status: 'stopped' },
      conflictCol: 'user_id',
    },
    {
      name: 'api_credentials',
      data: { user_id: BOT_OWNER_ID, has_credentials: false },
      conflictCol: 'user_id',
    },
  ];

  for (const { name, data, conflictCol } of tables) {
    try {
      const result = await supabaseAdmin.from(name).upsert(data, { onConflict: conflictCol });
      if (result.error) {
        // Unique index may not exist yet in older deployments — fall back to upsert
        const fallback = await supabaseAdmin.from(name).upsert(data, { onConflict: conflictCol, ignoreDuplicates: true });
        if (fallback.error) {
          console.error(`[Bootstrap] ${name}:`, fallback.error.message);
        } else {
          console.log(`[Bootstrap] ${name}: OK`);
        }
      } else {
        console.log(`[Bootstrap] ${name}: OK`);
      }
    } catch (err: unknown) {
      console.error(`[Bootstrap] ${name} EXCEPTION:`, err instanceof Error ? err.message : String(err));
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
  // Dev: Vite proxies /api to Express — but allow explicit localhost origins too
  // Prod: same-origin (Express serves both API + static files)
  if (!origin || !IS_PROD) {
    res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  } else {
    // Allow Render deploy URL if explicitly set (env var)
    const allowedProd = (process.env.ALLOWED_ORIGIN ?? '').split(',').filter(Boolean);
    if (allowedProd.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Owner-Access-Token');
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
    hasEncryptionKey: !!process.env.RENDER_SERVICE_ENCRYPTION_KEY,
    botOwnerId: BOT_OWNER_ID,
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

  // Bootstrap owner rows (auto-creates if not exist)
  await ensureOwnerRows().catch((e) => console.error('[Bootstrap] FATAL:', e.message));

  // Start the bot worker
  initializeBotWorker();
});

export { app, BOT_OWNER_ID };
