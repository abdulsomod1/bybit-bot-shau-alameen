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
  currentPrice: number, ranking: RankingResult, rule: {
    strategy?: string; fixed_price?: number; target_position?: number;
    offset_amount?: number; offset_type?: string;
    min_price?: number; max_price?: number;
    max_change_percent?: number; max_deviation_percent?: number; price_precision?: number;
    price_offset?: number; direction?: 'BUY' | 'SELL';
  },
): string | null {
  const strategy = rule.strategy ?? 'match_1st';
  if (strategy === 'monitor_only' || !Number.isFinite(currentPrice) || currentPrice <= 0) return null;

  let desired: number;
  if (strategy === 'fixed') {
    if (!Number.isFinite(rule.fixed_price) || !rule.fixed_price) return null;
    desired = rule.fixed_price;
  } else {
    const rank = strategy === 'match_2nd' || strategy === 'under_2nd' ? 2
      : strategy === 'match_3rd' || strategy === 'under_3rd' || strategy === 'offset_third' ? 3
      : strategy === 'fixed_offset' || strategy === 'offset_fixed' ? Math.max(1, rule.target_position ?? 1)
      : 1;
    const competitor = ranking.competitors[rank - 1];
    if (!competitor || !Number.isFinite(competitor.price) || competitor.price <= 0) return null;

    if (strategy.startsWith('under_')) {
      const precision = Math.max(0, Math.min(8, rule.price_precision ?? 2));
      const tick = Math.pow(10, -precision);
      const underBy = rule.offset_amount
        ? Math.abs(rule.offset_type === 'fixed' ? rule.offset_amount : competitor.price * rule.offset_amount / 100)
        : tick;
      desired = competitor.price - underBy;
    } else if (strategy === 'fixed_offset' || strategy === 'offset_fixed' || strategy === 'offset_third') {
      const amount = rule.price_offset ?? rule.offset_amount ?? 0;
      const signedAmount = strategy === 'offset_third' && rule.direction === 'SELL' ? -Math.abs(amount) : amount;
      desired = calcPrice(competitor.price, signedAmount, rule.offset_type ?? 'percentage');
    } else if (strategy.startsWith('match_')) {
      desired = competitor.price;
    } else {
      return null;
    }
  }

  const precision = Math.max(0, Math.min(8, rule.price_precision ?? 2));
  const boundedDesired = clamp(desired, rule.min_price, rule.max_price);
  const maxChangePercent = rule.max_change_percent ?? 5;
  if (!Number.isFinite(maxChangePercent) || maxChangePercent < 0) return null;
  const maxChange = maxChangePercent / 100 * currentPrice;
  const final = currentPrice + Math.max(-maxChange, Math.min(maxChange, boundedDesired - currentPrice));
  if (rule.max_deviation_percent != null) {
    if (!Number.isFinite(rule.max_deviation_percent) || rule.max_deviation_percent < 0) return null;
    if (Math.abs((final - currentPrice) / currentPrice * 100) > rule.max_deviation_percent) return null;
  }
  if ((rule.min_price != null && final < rule.min_price) || (rule.max_price != null && final > rule.max_price)) return null;

  const rounded = roundPrice(final, precision);
  if (!Number.isFinite(Number(rounded)) || Number(rounded) <= 0 || Number(rounded) === currentPrice) return null;
  return rounded;
}
