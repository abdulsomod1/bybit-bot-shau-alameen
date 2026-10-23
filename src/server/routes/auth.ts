// src/server/routes/auth.ts
// DISABLED — single-user desktop app does not use Supabase Auth.
// Auth routes are registered but return a no-op response.
// Remove registerAuthRoutes(app) from index.ts to fully disable.
import type { Express } from 'express';

export async function handleRegister(req: any, res: any) {
  res.status(410).json({ error: 'Registration is disabled (single-user app)' });
}

export async function handleLogin(req: any, res: any) {
  res.status(410).json({ error: 'Login is disabled (single-user app)' });
}

export function registerAuthRoutes(_app: Express) {
  // Routes exist but return errors — kept for API compatibility.
  // To fully remove: delete registerAuthRoutes(app) from index.ts.
}
