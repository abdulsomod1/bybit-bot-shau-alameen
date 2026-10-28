/// <reference types="vite/client" />

// ── Central constants ─────────────────────────────────────────────────────────

/**
 * The fixed UUID of the single bot owner.
 * Used for all database records. This is NOT a security credential —
 * it's a database relationship key. The owner access token protects the API.
 */
export const BOT_OWNER_ID = '00000000-0000-4000-8000-000000000001';
