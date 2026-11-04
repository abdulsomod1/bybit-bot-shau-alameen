// src/server/services/bybit-api.ts
// Bybit P2P API — high-level functions for the API server and bot worker.
import { apiReq, p2pReq } from './bybit-core.js';

export type ConnectionTestResult = {
  success: boolean; apiKeyPrefix?: string; error?: string; errorCode?: string;
};

export async function testBybitConnection(apiKey: string, apiSecret: string): Promise<ConnectionTestResult> {
  try {
    await apiReq('GET', '/v5/user/query-api', {}, apiKey, apiSecret);
    return { success: true, apiKeyPrefix: apiKey.slice(0, 6) };
  } catch (err: any) {
    const detail = err.ipError ? ' IP not whitelisted in Bybit.' : err.authError ? ' Invalid API key or secret.' : '';
    return { success: false, error: (err.message || 'Unknown') + detail, errorCode: String(err.retCode ?? '') };
  }
}

export async function getBybitAds(params: { apiKey: string; apiSecret: string }): Promise<any[]> {
  const { apiKey, apiSecret } = params;
  const result: any[] = [];
  for (let page = 1; page <= 100; page++) {
    const data = await p2pReq('POST', '/v5/p2p/item/personal/list', { page: String(page), size: '30' }, apiKey, apiSecret);
    const items = data?.items ?? [];
    result.push(...items.map((ad: any) => ({
      id: String(ad.id), account_id: ad.accountId,
      direction: Number(ad.side) === 0 ? 'BUY' : 'SELL',
      asset: ad.tokenId || 'USDT', fiat_currency: ad.currencyId,
      price: ad.price, available_quantity: ad.lastQuantity || ad.quantity,
      min_order_amount: ad.minAmount, max_order_amount: ad.maxAmount,
      status: Number(ad.status) === 10 ? 'online' : 'offline',
      last_update_time: ad.updateDate ? new Date(Number(ad.updateDate)).toISOString() : null,
      payment_methods: ad.payments ?? [],
      created_time: ad.createDate ? new Date(Number(ad.createDate)).toISOString() : null,
      updatePayload: {
        id: String(ad.id),
        priceType: ad.priceType == null ? undefined : String(ad.priceType),
        premium: ad.premium == null ? undefined : String(ad.premium),
        minAmount: ad.minAmount == null ? undefined : String(ad.minAmount),
        maxAmount: ad.maxAmount == null ? undefined : String(ad.maxAmount),
        quantity: ad.quantity == null && ad.lastQuantity == null ? undefined : String(ad.quantity ?? ad.lastQuantity),
        paymentIds: ad.payments,
        paymentPeriod: ad.paymentPeriod == null ? undefined : String(ad.paymentPeriod),
        remark: ad.remark == null ? undefined : String(ad.remark),
        tradingPreferenceSet: ad.tradingPreferenceSet,
        actionType: 'MODIFY',
      },
    })));
    if (items.length < 30 || result.length >= Number(data?.count ?? 0)) break;
  }
  return result;
}

export async function fetchMarketAds(
  p: { side: 'Buy' | 'Sell'; asset: string; fiatCurrency: string; minAmount?: string; maxAmount?: string; paymentMethodIds?: string[] },
  apiKey: string, apiSecret: string,
): Promise<any[]> {
  const req: Record<string, any> = {
    side: p.side === 'Buy' ? '0' : '1', tokenId: p.asset,
    currencyId: p.fiatCurrency, page: '1', size: '300',
  };
  if (p.paymentMethodIds?.length) req.paymentIds = p.paymentMethodIds;
  const ads = (await p2pReq('POST', '/v5/p2p/item/online', req, apiKey, apiSecret))?.items ?? [];
  return ads.map((ad: any) => ({
    id: String(ad.id), userName: ad.nickName || String(ad.userId ?? ''), nickname: ad.nickName || 'Unknown',
    direction: Number(ad.side) === 0 ? 'BUY' : 'SELL', asset: ad.tokenId, fiat_currency: ad.currencyId,
    price: ad.price, available_quantity: ad.lastQuantity || ad.quantity,
    min_order_amount: ad.minAmount, max_order_amount: ad.maxAmount,
    payment_methods: ad.payments ?? [],
    last_update_time: ad.updateDate ? new Date(Number(ad.updateDate)).toISOString() : null,
    completion_rate: ad.recentExecuteRate,
  }));
}

export async function updateAdPrice(ad: any, newPrice: string, apiKey: string, apiSecret: string): Promise<{ success: boolean; error?: string }> {
  try {
    const source = ad.updatePayload;
    const required = ['id', 'priceType', 'premium', 'minAmount', 'maxAmount', 'quantity', 'paymentIds', 'paymentPeriod', 'remark', 'tradingPreferenceSet', 'actionType'];
    if (!source || String(source.id) !== String(ad.id) || required.some((key) => source[key] == null) || !Array.isArray(source.paymentIds) || source.paymentIds.length === 0 || typeof source.tradingPreferenceSet !== 'object') {
      return { success: false, error: 'Bybit did not return all required ad fields; refusing to send a partial update.' };
    }
    await p2pReq('POST', '/v5/p2p/item/update', { ...source, price: newPrice }, apiKey, apiSecret);
    return { success: true };
  } catch (err: any) {
    if (err.ipError) return { success: false, error: 'Your current IP is not whitelisted in Bybit.' };
    if (err.authError) return { success: false, error: 'Invalid API key or secret.' };
    return { success: false, error: err.message || 'Failed to update ad price.' };
  }
}
