import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { claimPendingUpdate, getPendingUpdate, getPendingUpdates, queuePendingUpdate, releasePendingUpdate, removePendingUpdate } from '../server/services/pending-updates';

afterEach(() => {
  jest.useRealTimers();
});

describe('manual approval queue', () => {
  test('deduplicates the same owner, ad, and rule', () => {
    const input = { userId: 'owner-a', adId: 'ad-a', ruleId: 'rule-a', ruleName: 'Rule', currentPrice: 1, targetPrice: '1.01' };

    const queued = queuePendingUpdate(input);
    expect(queued).not.toBeNull();
    expect(queuePendingUpdate(input)).toBeNull();
  });

  test('does not expose or remove another owner\'s update', () => {
    const queued = queuePendingUpdate({ userId: 'owner-a', adId: 'ad-b', ruleId: 'rule-b', ruleName: 'Rule', currentPrice: 1, targetPrice: '1.02' });
    expect(queued).not.toBeNull();
    expect(getPendingUpdates('owner-b')).toEqual([]);
    expect(getPendingUpdate('owner-b', queued!.id)).toBeNull();
    expect(removePendingUpdate('owner-b', queued!.id)).toBe(false);
  });

  test('allows only one concurrent approval claim', () => {
    const queued = queuePendingUpdate({ userId: 'owner-c', adId: 'ad-d', ruleId: 'rule-d', ruleName: 'Rule', currentPrice: 1, targetPrice: '1.04' });
    expect(claimPendingUpdate('owner-c', queued!.id)).toBe(true);
    expect(claimPendingUpdate('owner-c', queued!.id)).toBe(false);
    releasePendingUpdate(queued!.id);
    expect(claimPendingUpdate('owner-c', queued!.id)).toBe(true);
    releasePendingUpdate(queued!.id);
  });

  test('expires pending decisions after ten minutes', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const queued = queuePendingUpdate({ userId: 'expiry-owner', adId: 'ad-c', ruleId: 'rule-c', ruleName: 'Rule', currentPrice: 1, targetPrice: '1.03' });
    jest.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(getPendingUpdate('expiry-owner', queued!.id)).toBeNull();
    expect(getPendingUpdates('expiry-owner')).toEqual([]);
  });
});