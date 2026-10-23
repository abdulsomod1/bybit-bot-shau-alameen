export interface PriceResult { price: number; valid: boolean; reason?: string; }

export function calculateTargetPrice(ranking: any, rule: any): PriceResult {
  if (!ranking || ranking.dataStale || !ranking.thirdRanked) {
    return { price: 0, valid: false, reason: 'Market data unavailable or stale' };
  }
  const thirdPrice = parseFloat(ranking.thirdRanked.price);
  if (isNaN(thirdPrice) || thirdPrice <= 0) {
    return { price: 0, valid: false, reason: 'Invalid third-ranked competitor price' };
  }
  let targetPrice = thirdPrice;
  if (rule.strategy === 'offset_third') {
    if (rule.offsetType === 'percentage') {
      targetPrice = rule.direction === 'SELL' ? thirdPrice * (1 - rule.offsetAmount / 100) : thirdPrice * (1 + rule.offsetAmount / 100);
    } else {
      targetPrice = rule.direction === 'SELL' ? thirdPrice - rule.offsetAmount : thirdPrice + rule.offsetAmount;
    }
  } else if (rule.strategy === 'fixed' && rule.fixedPrice) {
    targetPrice = rule.fixedPrice;
  } else if (rule.strategy === 'monitor_only') {
    return { price: thirdPrice, valid: true, reason: 'Monitor only - no update will be made' };
  }
  targetPrice = Math.round(targetPrice * Math.pow(10, rule.pricePrecision || 2)) / Math.pow(10, rule.pricePrecision || 2);
  if (rule.minPrice && targetPrice < rule.minPrice) return { price: rule.minPrice, valid: false, reason: `Below minimum price (${rule.minPrice})` };
  if (rule.maxPrice && targetPrice > rule.maxPrice) return { price: rule.maxPrice, valid: false, reason: `Above maximum price (${rule.maxPrice})` };
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
