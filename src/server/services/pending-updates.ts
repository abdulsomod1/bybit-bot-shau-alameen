import { randomUUID } from 'node:crypto';

export interface PendingUpdate {
  id: string;
  userId: string;
  adId: string;
  ruleId: string;
  ruleName: string;
  currentPrice: number;
  targetPrice: string;
  createdAt: string;
}

const EXPIRY_MS = 10 * 60 * 1000;
const pending = new Map<string, PendingUpdate>();
const inFlight = new Set<string>();

function removeExpired(): void {
  const expiry = Date.now() - EXPIRY_MS;
  for (const [id, update] of pending) {
    if (Date.parse(update.createdAt) < expiry) pending.delete(id);
  }
}

export function queuePendingUpdate(update: Omit<PendingUpdate, 'id' | 'createdAt'>): PendingUpdate | null {
  removeExpired();
  const duplicate = [...pending.values()].find((item) => item.userId === update.userId && item.adId === update.adId && item.ruleId === update.ruleId);
  if (duplicate) return null;
  const queued: PendingUpdate = { ...update, id: randomUUID(), createdAt: new Date().toISOString() };
  pending.set(queued.id, queued);
  return queued;
}

export function getPendingUpdates(userId: string): PendingUpdate[] {
  removeExpired();
  return [...pending.values()].filter((update) => update.userId === userId);
}

export function getPendingUpdate(userId: string, id: string): PendingUpdate | null {
  removeExpired();
  const update = pending.get(id);
  return update?.userId === userId ? update : null;
}

export function removePendingUpdate(userId: string, id: string): boolean {
  const update = pending.get(id);
  if (update?.userId !== userId) return false;
  return pending.delete(id);
}

export function claimPendingUpdate(userId: string, id: string): boolean {
  if (!getPendingUpdate(userId, id) || inFlight.has(id)) return false;
  inFlight.add(id);
  return true;
}

export function releasePendingUpdate(id: string): void {
  inFlight.delete(id);
}