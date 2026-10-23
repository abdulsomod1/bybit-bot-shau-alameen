// src/server/services/bot-algorithms.ts
// Pure pricing/ranking algorithms extracted from bot-worker.
// No side effects — pure functions only.
export interface RankEntry {
  id: string; price: number; userName?: string; nickname?: string;
}
export interface RankingResult {
  competitors: RankEntry[]; first: RankEntry | null;
  second: RankEntry | null; third: RankEntry | null;
}

export function parsePrice(priceStr: string): number {
  return parseFloat(String(priceStr).replace(/[^\d.-]/g, '')) || 0;
}

export function computeRankings(ads: any[], direction: 'BUY' | 'SELL'): RankingResult {
  const sorted = ads
    .filter((ad) => ad.direction?.toUpperCase() === direction)
    .map((ad) => ({ id: ad.id, price: parsePrice(ad.price), userName: ad.userName, nickname: ad.nickname }))
    .sort((a, b) => direction === 'SELL' ? a.price - b.price : b.price - a.price);
  return { competitors: sorted, first: sorted[0] ?? null, second: sorted[1] ?? null, third: sorted[2] ?? null };
}

export function calcPrice(competitorPrice: number, offsetAmount: number, offsetType: string): number {
  return offsetType === 'fixed' ? competitorPrice + offsetAmount : competitorPrice * (1 + offsetAmount / 100);
}

export function clamp(value: number, min?: number, max?: number): number {
  if (min != null && value < min) return min;
  if (max != null && value > max) return max;
  return value;
}

export function roundPrice(price: number, precision = 2): string {
  return price.toFixed(precision);
}

export function computeTargetPrice(
  currentPrice: number, targetPrice: number, rule: {
    offset_amount?: number; offset_type?: string;
    min_price?: number; max_price?: number;
    max_change_percent?: number; price_precision?: number;
  },
): string | null {
  const desired = clamp(
    calcPrice(targetPrice, rule.offset_amount ?? 0, rule.offset_type ?? 'percentage'),
    rule.min_price, rule.max_price,
  );
  const maxChange = Math.abs((rule.max_change_percent ?? 5) / 100 * currentPrice);
  let final = desired;
  if (Math.abs(desired - currentPrice) > maxChange) {
    final = currentPrice + (desired > currentPrice ? maxChange : -maxChange);
  }
  const rounded = roundPrice(final, rule.price_precision ?? 2);
  // No change needed
  if (Math.abs(parseFloat(rounded) - currentPrice) < 0.001) return null;
  return rounded;
}
