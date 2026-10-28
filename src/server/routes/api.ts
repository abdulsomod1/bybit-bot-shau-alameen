// src/server/routes/api.ts
// Route registrations for all authenticated API endpoints.
// Handler implementations live in api-handlers.ts.
import type { Express } from 'express';
import { requireAuth, requireOwnerToken } from '../middleware/auth.js';
import {
  handleGetSettings, handleSaveSettings,
  handleGetCredentials, handleSaveCredentials, handleDeleteCredentials, handleTestConnection,
  handleGetAds, handleFetchAds, handleUpdateAdSelected,
  handleGetRules, handleSaveRule, handleDeleteRule,
  handleGetRankings,
  handleGetLogs, handleClearLogs,
  handleGetBotState, handleUpdateBotState,
} from './api-handlers.js';

// Apply owner token check + set bot owner ID on all routes
function auth(handler: any) {
  return [requireOwnerToken, requireAuth, handler];
}

export function registerApiRoutes(app: Express) {
  // Settings
  app.get('/api/settings', ...auth(handleGetSettings));
  app.post('/api/settings', ...auth(handleSaveSettings));

  // Credentials (no secret is ever returned to the browser)
  app.get('/api/credentials', ...auth(handleGetCredentials));
  app.post('/api/credentials', ...auth(handleSaveCredentials));
  app.delete('/api/credentials', ...auth(handleDeleteCredentials));
  app.post('/api/credentials/test', ...auth(handleTestConnection));

  // Ads
  app.get('/api/ads', ...auth(handleGetAds));
  app.post('/api/ads/fetch', ...auth(handleFetchAds));
  app.post('/api/ads/select', ...auth(handleUpdateAdSelected));

  // Rules
  app.get('/api/rules', ...auth(handleGetRules));
  app.post('/api/rules', ...auth(handleSaveRule));
  app.delete('/api/rules/:id', ...auth(handleDeleteRule));

  // Rankings
  app.get('/api/rankings', ...auth(handleGetRankings));

  // Logs
  app.get('/api/logs', ...auth(handleGetLogs));
  app.delete('/api/logs', ...auth(handleClearLogs));

  // Bot state
  app.get('/api/bot-state', ...auth(handleGetBotState));
  app.post('/api/bot-state', ...auth(handleUpdateBotState));
}
