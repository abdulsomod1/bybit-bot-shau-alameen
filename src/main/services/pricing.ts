export interface PriceResult { price: number; valid: boolean; reason?: string; }

export function calculateTargetPrice(ranking: any, rule: any): PriceResult {
  if (!ranking || ranking.dataStale) {
    return { price: 0, valid: false, reason: 'Market data unavailable or stale' };
  }

  if (rule.strategy === 'monitor_only') {
    return { price: 0, valid: false, reason: 'Monitor only - no update will be made' };
  }

  const competitors = (ranking.competitors ?? [ranking.firstRanked, ranking.secondRanked, ranking.thirdRanked])
    .filter((competitor: any) => competitor != null);
  const strategy = String(rule.strategy ?? 'match_1st');
  let targetPrice: number;
  if (strategy === 'fixed') {
    targetPrice = Number(rule.fixedPrice);
  } else {
    const rank = strategy === 'match_2nd' || strategy === 'under_2nd' ? 2
      : strategy === 'match_3rd' || strategy === 'under_3rd' || strategy === 'offset_third' ? 3
      : strategy === 'fixed_offset' || strategy === 'offset_fixed' ? Math.max(1, Number(rule.targetPosition ?? 1))
      : 1;
    const competitorPrice = Number(competitors[rank - 1]?.price);
    if (!Number.isFinite(competitorPrice) || competitorPrice <= 0) {
      return { price: 0, valid: false, reason: `Competitor rank ${rank} is unavailable` };
    }

    if (strategy.startsWith('under_')) {
      const precision = Math.max(0, Math.min(8, Number(rule.pricePrecision || 2)));
      const tick = Math.pow(10, -precision);
      const offset = Number(rule.offsetAmount ?? 0);
      const underBy = offset ? (rule.offsetType === 'fixed' ? Math.abs(offset) : competitorPrice * Math.abs(offset) / 100) : tick;
      targetPrice = competitorPrice - underBy;
    } else if (strategy === 'fixed_offset' || strategy === 'offset_fixed' || strategy === 'offset_third') {
      let offset = Number(rule.priceOffset ?? rule.offsetAmount ?? 0);
      if (strategy === 'offset_third' && rule.direction === 'SELL') offset = -Math.abs(offset);
      targetPrice = rule.offsetType === 'fixed' ? competitorPrice + offset : competitorPrice * (1 + offset / 100);
    } else if (strategy.startsWith('match_')) {
      targetPrice = competitorPrice;
    } else {
      return { price: 0, valid: false, reason: `Unsupported strategy: ${strategy}` };
    }
  }

  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    return { price: 0, valid: false, reason: 'Calculated price is invalid' };
  }
  if (rule.minPrice && targetPrice < rule.minPrice) return { price: rule.minPrice, valid: false, reason: `Below minimum price (${rule.minPrice})` };
  if (rule.maxPrice && targetPrice > rule.maxPrice) return { price: rule.maxPrice, valid: false, reason: `Above maximum price (${rule.maxPrice})` };
  const precision = Math.max(0, Math.min(8, Number(rule.pricePrecision || 2)));
  targetPrice = Math.round(targetPrice * Math.pow(10, precision)) / Math.pow(10, precision);
  return { price: targetPrice, valid: true };
}

export function validatePriceChange(currentPrice: number, newPrice: number, maxChangePercent: number): { valid: boolean; reason?: string } {
  if (!currentPrice || currentPrice <= 0) return { valid: false, reason: 'Invalid current price' };
  const changePercent = Math.abs((newPrice - currentPrice) / currentPrice * 100);
  if (maxChangePercent > 0 && changePercent > maxChangePercent) {
    return { valid: false, reason: `Price change ${changePercent.toFixed(2)}% exceeds max ${maxChangePercent}%` };
  }
  return { valid: true };
}

export function formatPrice(price: number, precision: number): string {
  return price.toFixed(precision);
}
