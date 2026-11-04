import { describe, expect, test } from '@jest/globals';
import { computeRankings, computeTargetPrice } from '../server/services/bot-algorithms';
import { calculateTargetPrice } from '../main/services/pricing';
import { rankCompetitors } from '../main/services/ranking';

const rule = (values: Record<string, unknown> = {}) => ({
  strategy: 'match_3rd',
  max_change_percent: 100,
  max_deviation_percent: 100,
  price_precision: 2,
  ...values,
});

describe('hosted bot pricing strategies', () => {
  test('matches the selected competitor rank for BUY and SELL markets', () => {
    const buy = computeRankings([{ id: 'a', direction: 'BUY', price: '10' }, { id: 'b', direction: 'BUY', price: '12' }, { id: 'c', direction: 'BUY', price: '11' }], 'BUY');
    const sell = computeRankings([{ id: 'a', direction: 'SELL', price: '10' }, { id: 'b', direction: 'SELL', price: '12' }, { id: 'c', direction: 'SELL', price: '11' }], 'SELL');

    expect(computeTargetPrice(9, buy, rule({ strategy: 'match_2nd' }))).toBe('11.00');
    expect(computeTargetPrice(9, sell, rule({ strategy: 'match_2nd' }))).toBe('11.00');
  });

  test('uses the fixed price and the configured competitor offset', () => {
    const ranking = computeRankings([{ id: 'a', direction: 'SELL', price: '10' }], 'SELL');

    expect(computeTargetPrice(9, ranking, rule({ strategy: 'fixed', fixed_price: 10.25 }))).toBe('10.25');
    expect(computeTargetPrice(9, ranking, rule({ strategy: 'fixed_offset', offset_amount: 2, offset_type: 'fixed' }))).toBe('12.00');
  });

  test('does not produce a target for monitor-only or a missing rank', () => {
    const ranking = computeRankings([{ id: 'a', direction: 'SELL', price: '10' }], 'SELL');

    expect(computeTargetPrice(9, ranking, rule({ strategy: 'monitor_only' }))).toBeNull();
    expect(computeTargetPrice(9, ranking, rule({ strategy: 'match_3rd' }))).toBeNull();
  });

  test('applies undercut, price bounds, and change limits', () => {
    const ranking = computeRankings([{ id: 'a', direction: 'SELL', price: '10' }], 'SELL');

    expect(computeTargetPrice(9, ranking, rule({ strategy: 'under_1st', max_change_percent: 100 }))).toBe('9.99');
    expect(computeTargetPrice(9, ranking, rule({ strategy: 'match_1st', max_change_percent: 5 }))).toBe('9.45');
    expect(computeTargetPrice(9, ranking, rule({ strategy: 'match_1st', min_price: 9.5 }))).toBe('10.00');
    expect(computeTargetPrice(9, ranking, rule({ strategy: 'match_1st', max_deviation_percent: 5 }))).toBeNull();
  });
});

describe('Electron bot pricing', () => {
  test('ranks BUY prices highest-first and SELL prices lowest-first', () => {
    const ads = [
      { id: 'a', price: '10' },
      { id: 'b', price: '12' },
      { id: 'c', price: '11' },
    ];
    expect(rankCompetitors(ads, 'BUY').map((ad) => ad.price)).toEqual(['12', '11', '10']);
    expect(rankCompetitors(ads, 'SELL').map((ad) => ad.price)).toEqual(['10', '11', '12']);
  });

  test('calculates Match #2 from the persisted competitors array', () => {
    const ranking = {
      dataStale: false,
      competitors: [{ price: '12' }, { price: '11' }, { price: '10' }],
    };
    expect(calculateTargetPrice(ranking, { strategy: 'match_2nd', pricePrecision: 2 })).toMatchObject({ price: 11, valid: true });
  });
});