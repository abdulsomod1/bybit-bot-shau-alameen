
import * as crypto from 'crypto';
import log from 'electron-log';

const BYBIT_API_URL = 'https://api.bybit.com';
const BYBIT_P2P_URL = 'https://p2p-api.bybit.com';
const RECV_WINDOW = 5000;

type ApiParams = Record<string, any>;

type ConnectionTestResult = {
  success: boolean;
  apiKeyPrefix?: string;
  error?: string;
  errorCode?: string;
  rawResponse?: string;
};

function hmac(message: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }

  return `${key.substring(0, 4)}****${key.substring(key.length - 4)}`;
}

function normalizeParams(params: ApiParams): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const key of Object.keys(params).sort()) {
    normalized[key] = String(params[key]);
  }

  return normalized;
}

function queryString(
  params: Record<string, string>,
  encodeValues = false
): string {
  return Object.keys(params)
    .map((key) => {
      const value = encodeValues
        ? encodeURIComponent(params[key])
        : params[key];

      return `${key}=${value}`;
    })
    .join('&');
}

async function readResponse(response: Response): Promise<{
  text: string;
  data: any;
}> {
  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON response (HTTP ${response.status}): ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${data?.retMsg || data?.ret_msg || response.statusText}`
    );
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Malformed API response: expected a JSON object.');
  }

  return { text, data };
}

/**
 * Bybit V5 API request.
 * V5 responses use retCode, retMsg and result.
 */
async function apiReq(
  method: string,
  endpoint: string,
  params: ApiParams,
  key: string,
  secret: string
): Promise<any> {
  const timestamp = Date.now().toString();
  const normalized = normalizeParams(params);
  const paramsString = queryString(normalized);

  const signaturePayload =
    `${timestamp}${key}${RECV_WINDOW}${paramsString}`;

  const signature = hmac(signaturePayload, secret);

  const url =
    `${BYBIT_API_URL}${endpoint}` +
    (paramsString ? `?${paramsString}` : '');

  log.info(`[Bybit API] ${method} ${endpoint}`);

  const response = await fetch(url, {
    method,
    headers: {
      'X-BAPI-API-KEY': key,
      'X-BAPI-SIGN': signature,
      'X-BAPI-SIGN-TYPE': '2',
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW.toString(),
      'Content-Type': 'application/json',
    },
  });

  const { data } = await readResponse(response);

  log.info(
    `[Bybit API] Response retCode=${data.retCode} retMsg=${data.retMsg}`
  );

  if (typeof data.retCode !== 'number') {
    throw new Error(
      'Malformed Bybit V5 response: missing or invalid retCode.'
    );
  }

  if (data.retCode !== 0) {
    const error: any = new Error(data.retMsg || 'Bybit API error');
    error.retCode = data.retCode;
    error.retMsg = data.retMsg;
    throw error;
  }

  return data.result;
}

/**
 * Legacy P2P request helper.
 *
 * This preserves the response field names used by the existing
 * legacy P2P implementation. It does not convert legacy endpoints
 * into V5 endpoints.
 */
async function p2pReq(
  method: string,
  endpoint: string,
  params: ApiParams,
  key: string,
  secret: string
): Promise<any> {
  const timestamp = Date.now().toString();
  const normalized = normalizeParams(params);
  const paramsString = queryString(normalized, true);

  const signaturePayload =
    `${timestamp}${key}${RECV_WINDOW}${paramsString}`;

  const signature = hmac(signaturePayload, secret);

  const url =
    `${BYBIT_P2P_URL}${endpoint}` +
    (paramsString ? `?${paramsString}` : '');

  log.info(`[Bybit P2P] ${method} ${endpoint}`);

  const response = await fetch(url, {
    method,
    headers: {
      'X-BAPI-API-KEY': key,
      'X-BAPI-SIGN': signature,
      'X-BAPI-SIGN-TYPE': '2',
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW.toString(),
      'Content-Type': 'application/json',
    },
  });

  const { data } = await readResponse(response);

  // Some legacy endpoints use ret_code/ret_msg, while others
  // may return retCode/retMsg. Accept either response format.
  const returnCode = data.retCode ?? data.ret_code;
  const returnMessage = data.retMsg ?? data.ret_msg;

  log.info(
    `[Bybit P2P] Response retCode=${returnCode} retMsg=${returnMessage}`
  );

  if (returnCode == null) {
    throw new Error(
      'Malformed P2P API response: missing return code.'
    );
  }

  if (Number(returnCode) !== 0) {
    const error: any = new Error(returnMessage || 'P2P API error');
    error.retCode = Number(returnCode);
    error.retMsg = returnMessage;
    error.ret_code = Number(returnCode);
    error.ret_msg = returnMessage;
    throw error;
  }

  return data.result;
}

/**
 * Tests API-key authentication using Bybit's V5 query-api endpoint.
 */
export async function testBybitConnection(
  key: string,
  secret: string
): Promise<ConnectionTestResult> {
  if (!key?.trim() || !secret?.trim()) {
    return {
      success: false,
      error: 'Enter both your Bybit API key and API secret.',
      errorCode: 'MISSING_CREDENTIALS',
    };
  }

  const timestamp = Date.now().toString();

  // GET /v5/user/query-api has no query parameters.
  const signature = hmac(
    `${timestamp}${key}${RECV_WINDOW}`,
    secret
  );

  let rawText = '';
  let rawStatus = 0;

  try {
    const response = await fetch(
      `${BYBIT_API_URL}/v5/user/query-api`,
      {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': key,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': RECV_WINDOW.toString(),
        },
      }
    );

    rawStatus = response.status;
    rawText = await response.text();

    log.info(
      `[Bybit connection test] HTTP ${rawStatus}; response received.`
    );

    let data: any;

    try {
      data = JSON.parse(rawText);
    } catch {
      log.error(
        `[Bybit connection test] Invalid JSON response: ${rawText.slice(0, 300)}`
      );

      return {
        success: false,
        error: `Bybit returned a non-JSON response (HTTP ${rawStatus}).`,
        errorCode: 'MALFORMED_RESPONSE',
        rawResponse: rawText.slice(0, 1000),
      };
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        success: false,
        error: 'Malformed API response: expected a JSON object.',
        errorCode: 'MALFORMED_RESPONSE',
        rawResponse: rawText.slice(0, 1000),
      };
    }

    // IMPORTANT: Bybit V5 uses retCode, not ret_code.
    if (typeof data.retCode !== 'number') {
      log.error(
        `[Bybit connection test] Missing or invalid retCode. HTTP ${rawStatus}.`
      );

      return {
        success: false,
        error:
          'Malformed Bybit V5 response: missing or invalid retCode.',
        errorCode: 'MALFORMED_RESPONSE',
        rawResponse: rawText.slice(0, 1000),
      };
    }

    if (data.retCode === 0) {
      return {
        success: true,
        apiKeyPrefix: maskApiKey(key),
        rawResponse: rawText.slice(0, 1000),
      };
    }

    const code = Number(data.retCode);
    const message = String(data.retMsg || 'Bybit API error');

    log.warn(
      `[Bybit connection test] API returned retCode=${code}: ${message}`
    );

    if (code === 10003) {
      return {
        success: false,
        error: 'Invalid API key or API key does not match this environment.',
        errorCode: 'ERR_INVALID_API_KEY',
        rawResponse: rawText.slice(0, 1000),
      };
    }

    if (code === 10010) {
      return {
        success: false,
        error:
          'Your current public IP is not allowed by the API key. Check the IP whitelist in Bybit.',
        errorCode: 'ERR_IP_NOT_WHITELISTED',
        rawResponse: rawText.slice(0, 1000),
      };
    }

    if (code === 10002) {
      return {
        success: false,
        error:
          'The request timestamp is outside the allowed receive window. Check your computer clock and try again.',
        errorCode: 'ERR_TIMESTAMP',
        rawResponse: rawText.slice(0, 1000),
      };
    }

    if (code === 10004) {
      return {
        success: false,
        error:
          'The request signature is invalid. Check your API secret and signing configuration.',
        errorCode: 'ERR_SIGNATURE',
        rawResponse: rawText.slice(0, 1000),
      };
    }

    if (code === 10005 || code === 10007) {
      return {
        success: false,
        error:
          'Bybit denied the request. Check the API key permissions and account access.',
        errorCode: `ERR_PERMISSION_${code}`,
        rawResponse: rawText.slice(0, 1000),
      };
    }

    return {
      success: false,
      error: message,
      errorCode: String(code),
      rawResponse: rawText.slice(0, 1000),
    };
  } catch (error: any) {
    const message = error?.message || 'Unknown connection error';

    log.error(
      `[Bybit connection test] Request failed: ${message}; HTTP ${rawStatus}`
    );

    return {
      success: false,
      error: rawStatus > 0
        ? `Request failed: ${message} (HTTP ${rawStatus})`
        : `Network error: ${message}`,
      errorCode: rawStatus > 0 ? `HTTP_${rawStatus}` : 'NETWORK',
      rawResponse: rawText
        ? rawText.slice(0, 1000)
        : undefined,
    };
  }
}

export async function fetchMyAds(
  key: string,
  secret: string
): Promise<any[]> {
  const result = await p2pReq(
    'GET',
    '/v2/otc/item/list',
    { page: 1, limit: 100 },
    key,
    secret
  );

  return (result?.list || []).map((ad: any) => ({
    id: ad.id,
    accountId: ad.account_id,
    direction: ad.side === 'Sell' ? 'SELL' : 'BUY',
    asset: ad.asset || 'USDT',
    fiatCurrency: ad.fiat_ccy || ad.fiat_en,
    price: ad.price,
    availableQuantity: ad.tradable_amount || ad.amount,
    minOrderAmount: ad.min_amount,
    maxOrderAmount: ad.max_amount,
    status: ad.status === 1 ? 'online' : 'offline',
    lastUpdateTime: ad.update_time
      ? new Date(ad.update_time * 1000).toISOString()
      : undefined,
    paymentMethods: ad.payment_names
      ? ad.payment_names.split(',')
      : [],
    createdTime: ad.create_time
      ? new Date(ad.create_time * 1000).toISOString()
      : undefined,
  }));
}

export async function fetchMarketAds(
  params: {
    side: 'Buy' | 'Sell';
    asset: string;
    fiatCurrency: string;
    minAmount?: string;
    maxAmount?: string;
    paymentMethodIds?: string[];
  },
  key: string,
  secret: string
): Promise<any[]> {
  const requestParams: Record<string, any> = {
    side: params.side,
    asset: params.asset,
    fiat: params.fiatCurrency,
    page: 1,
    limit: 50,
  };

  if (params.minAmount) {
    requestParams.min_amount = params.minAmount;
  }

  if (params.maxAmount) {
    requestParams.max_amount = params.maxAmount;
  }

  let ads =
    (await p2pReq(
      'GET',
      '/v2/otc/item/list',
      requestParams,
      key,
      secret
    ))?.list || [];

  if (params.paymentMethodIds?.length) {
    ads = ads.filter((ad: any) => {
      if (!ad.payment_ids) {
        return false;
      }

      const paymentIds = String(ad.payment_ids).split(',');

      return params.paymentMethodIds!.some((paymentMethodId) =>
        paymentIds.includes(paymentMethodId)
      );
    });
  }

  return ads.map((ad: any) => ({
    id: ad.id,
    userName: ad.user_nickname || ad.user_id,
    nickname: ad.user_nickname || 'Unknown',
    direction: ad.side,
    asset: ad.asset,
    fiatCurrency: ad.fiat_ccy || ad.fiat_en,
    price: ad.price,
    availableQuantity: ad.tradable_amount || ad.amount,
    minOrderAmount: ad.min_amount,
    maxOrderAmount: ad.max_amount,
    paymentMethods: ad.payment_names
      ? ad.payment_names.split(',')
      : [],
    lastUpdateTime: ad.update_time
      ? new Date(ad.update_time * 1000).toISOString()
      : undefined,
    completionRate: ad.completed_business_count
      ? Math.round(
          (ad.completed_business_count /
            Math.max(ad.total_trade_count || 1, 1)) *
            100
        )
      : undefined,
  }));
}

export async function updateAdPrice(
  adId: string,
  newPrice: string,
  key: string,
  secret: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await p2pReq(
      'POST',
      '/v2/otc/item/update',
      { id: adId, price: newPrice },
      key,
      secret
    );

    return { success: true };
  } catch (error: any) {
    log.error('[Bybit P2P] updateAdPrice failed:', error);

    const code = Number(error?.retCode ?? error?.ret_code);

    if (code === 10010) {
      return {
        success: false,
        error:
          'Your current IP is not allowed. Check the IP whitelist in Bybit.',
      };
    }

    return {
      success: false,
      error: error?.message || 'Failed to update the ad price.',
    };
  }
}
