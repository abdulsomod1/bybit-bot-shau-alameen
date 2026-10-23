// src/server/services/bybit-api.ts
// Bybit P2P API — high-level functions for the API server and bot worker.
import { apiReq, p2pReq } from './bybit-core.js';

export type ConnectionTestResult = {
  success: boolean; apiKeyPrefix?: string; error?: string; errorCode?: string;
};

export async function testBybitConnection(apiKey: string, apiSecret: string): Promise<ConnectionTestResult> {
  try {
    await apiReq('GET', '/v5/api-key/info', {}, apiKey, apiSecret);
    return { success: true, apiKeyPrefix: apiKey.slice(0, 6) };
  } catch (err: any) {
    const detail = err.ipError ? ' IP not whitelisted in Bybit.' : err.authError ? ' Invalid API key or secret.' : '';
    return { success: false, error: (err.message || 'Unknown') + detail, errorCode: String(err.retCode ?? '') };
  }
}

export async function getBybitAds(params: { apiKey: string; apiSecret: string }): Promise<any[]> {
  const { apiKey, apiSecret } = params;
  const result: any[] = [];
  for (const side of ['Buy', 'Sell'] as const) {
    const data = await p2pReq('GET', '/v2/otc/item/list', { side, asset: 'USDT', fiat: 'USD', page: 1, limit: 50 }, apiKey, apiSecret);
    (data?.list ?? []).forEach((ad: any) => {
      result.push({
        id: ad.id, account_id: ad.account_id, userName: ad.user_nickname,
        direction: ad.side, asset: ad.asset || 'USDT', fiat_currency: ad.fiat_ccy || ad.fiat_en,
        price: ad.price, available_quantity: ad.tradable_amount || ad.amount,
        min_order_amount: ad.min_amount, max_order_amount: ad.max_amount,
        status: ad.status === 1 ? 'online' : 'offline',
        last_update_time: ad.update_time ? new Date(ad.update_time * 1000).toISOString() : null,
        payment_methods: ad.payment_names ? ad.payment_names.split(',') : [],
        created_time: ad.create_time ? new Date(ad.create_time * 1000).toISOString() : null,
      });
    });
  }
  return result;
}

export async function fetchMarketAds(
  p: { side: 'Buy' | 'Sell'; asset: string; fiatCurrency: string; minAmount?: string; maxAmount?: string; paymentMethodIds?: string[] },
  apiKey: string, apiSecret: string,
): Promise<any[]> {
  const req: Record<string, any> = { side: p.side, asset: p.asset, fiat: p.fiatCurrency, page: 1, limit: 50 };
  if (p.minAmount) req.min_amount = p.minAmount;
  if (p.maxAmount) req.max_amount = p.maxAmount;
  let ads = (await p2pReq('GET', '/v2/otc/item/list', req, apiKey, apiSecret))?.list ?? [];
  if (p.paymentMethodIds?.length) {
    ads = ads.filter((ad: any) => {
      if (!ad.payment_ids) return false;
      const ids = String(ad.payment_ids).split(',');
      return p.paymentMethodIds!.some((id) => ids.includes(id));
    });
  }
  return ads.map((ad: any) => ({
    id: ad.id, userName: ad.user_nickname, nickname: ad.user_nickname || 'Unknown',
    direction: ad.side, asset: ad.asset, fiat_currency: ad.fiat_ccy || ad.fiat_en,
    price: ad.price, available_quantity: ad.tradable_amount || ad.amount,
    min_order_amount: ad.min_amount, max_order_amount: ad.max_amount,
    payment_methods: ad.payment_names ? ad.payment_names.split(',') : [],
    last_update_time: ad.update_time ? new Date(ad.update_time * 1000).toISOString() : null,
    completion_rate: ad.completed_business_count
      ? Math.round((ad.completed_business_count / Math.max(ad.total_trade_count || 1, 1)) * 100) : undefined,
  }));
}

export async function updateAdPrice(adId: string, newPrice: string, apiKey: string, apiSecret: string): Promise<{ success: boolean; error?: string }> {
  try {
    await p2pReq('POST', '/v2/otc/item/update', { id: adId, price: newPrice }, apiKey, apiSecret);
    return { success: true };
  } catch (err: any) {
    if (err.ipError) return { success: false, error: 'Your current IP is not whitelisted in Bybit.' };
    if (err.authError) return { success: false, error: 'Invalid API key or secret.' };
    return { success: false, error: err.message || 'Failed to update ad price.' };
  }
}
