import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { createHmac } from 'node:crypto';
import { getBybitAds, updateAdPrice } from '../server/services/bybit-api';
import { p2pReq } from '../server/services/bybit-core';

const apiKey = 'test-key';
const apiSecret = 'test-secret';

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(data),
  } as Response;
}

afterEach(() => jest.restoreAllMocks());

describe('Bybit V5 P2P requests', () => {
  test('sends signed JSON POST requests and unwraps the result', async () => {
    const body = { side: '0', tokenId: 'USDT', currencyId: 'USD' };
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({ ret_code: 0, result: { items: [] } }));

    await expect(p2pReq('POST', '/v5/p2p/item/online', body, apiKey, apiSecret)).resolves.toEqual({ items: [] });

    const [url, init] = fetch.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    const timestamp = headers['X-BAPI-TIMESTAMP'];
    expect(url).toBe('https://api.bybit.com/v5/p2p/item/online');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(body));
    expect(headers['X-BAPI-SIGN']).toBe(createHmac('sha256', apiSecret)
      .update(`${timestamp}${apiKey}5000${JSON.stringify(body)}`).digest('hex'));
  });

  test('fetches personal ads from V5 and preserves update fields', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({ ret_code: 0, result: {
      count: 1,
      items: [{
        id: 'ad-1', side: 0, tokenId: 'USDT', currencyId: 'USD', price: '1.01',
        lastQuantity: '100', minAmount: '10', maxAmount: '100', status: 10,
        updateDate: '1770000000000', createDate: '1760000000000',
        priceType: 0, premium: '0', quantity: '100', payments: ['1'],
        paymentPeriod: 15, remark: 'safe', tradingPreferenceSet: {},
      }],
    } }));

    const ads = await getBybitAds({ apiKey, apiSecret });

    expect(ads).toHaveLength(1);
    expect(ads[0]).toMatchObject({ id: 'ad-1', direction: 'BUY', asset: 'USDT', fiat_currency: 'USD', status: 'online' });
    expect(ads[0].updatePayload).toMatchObject({ id: 'ad-1', priceType: '0', paymentIds: ['1'], actionType: 'MODIFY' });
    expect(fetch.mock.calls[0][0]).toBe('https://api.bybit.com/v5/p2p/item/personal/list');
    expect((fetch.mock.calls[0][1]?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  test('refuses partial update payloads without making a network request', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({ ret_code: 0, result: {} }));
    const result = await updateAdPrice({ id: 'ad-1' }, '1.02', apiKey, apiSecret);

    expect(result.success).toBe(false);
    expect(result.error).toContain('refusing to send a partial update');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('sends the complete existing ad fields with the new price', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(response({ ret_code: 0, result: {} }));
    const updatePayload = {
      id: 'ad-1', priceType: '0', premium: '0', minAmount: '10', maxAmount: '100',
      quantity: '100', paymentIds: ['1'], paymentPeriod: '15', remark: 'safe',
      tradingPreferenceSet: {}, actionType: 'MODIFY',
    };

    await expect(updateAdPrice({ id: 'ad-1', updatePayload }, '1.02', apiKey, apiSecret)).resolves.toEqual({ success: true });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.bybit.com/v5/p2p/item/update');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ ...updatePayload, price: '1.02' });
  });
});