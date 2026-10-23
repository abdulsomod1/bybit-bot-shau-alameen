export function rankCompetitors(ads: any[], direction: 'BUY' | 'SELL'): any[] {
  const filtered = ads.filter(ad => ad.price && !isNaN(parseFloat(ad.price)));
  const sorted = [...filtered].sort((a, b) => {
    const diff = parseFloat(a.price) - parseFloat(b.price);
    if (direction === 'BUY') return diff; // Highest BUY price = rank 1 (best for seller)
    return -diff; // Lowest SELL price = rank 1 (best for buyer)
  });
  return sorted.map((ad, i) => ({ ...ad, rank: i + 1 }));
}

export function getTopThreeCompetitors(ranked: any[]): { first: any; second: any; third: any } | null {
  if (ranked.length < 3) return null;
  return { first: ranked[0], second: ranked[1], third: ranked[2] };
}

export function buildMarketKey(direction: string, asset: string, fiat: string): string {
  return `${direction}_${asset}_${fiat}`.toUpperCase();
}
