// src/server/services/bybit-core.ts
// Low-level Bybit crypto + HTTP utilities. Shared by all Bybit API functions.
import * as crypto from 'crypto';

const BYBIT_API_URL = 'https://api.bybit.com';
const BYBIT_P2P_URL = 'https://p2p-api.bybit.com';
const RECV_WINDOW = 5000;
type ApiParams = Record<string, any>;

export function hmac(msg: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(msg).digest('hex');
}

export function normalizeParams(params: ApiParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(params).sort()) out[k] = String(params[k]);
  return out;
}

export function qs(params: Record<string, string>): string {
  return Object.keys(params).map((k) => `${k}=${params[k]}`).join('&');
}

export async function readResponse(response: Response): Promise<{ text: string; data: any }> {
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Invalid JSON (${response.status}): ${text.slice(0, 200)}`); }
  if (!response.ok) throw new Error(data?.retMsg ?? response.statusText);
  if (!data || typeof data !== 'object') throw new Error('Malformed API response');
  return { text, data };
}

export async function apiReq(
  method: string, endpoint: string, params: ApiParams, key: string, secret: string,
): Promise<any> {
  const timestamp = Date.now().toString();
  const pStr = qs(normalizeParams(params));
  const sig = hmac(`${timestamp}${key}${RECV_WINDOW}${pStr}`, secret);
  const response = await fetch(`${BYBIT_API_URL}${endpoint}${pStr ? `?${pStr}` : ''}`, {
    method,
    headers: {
      'X-BAPI-API-KEY': key, 'X-BAPI-SIGN': sig,
      'X-BAPI-SIGN-TYPE': '2', 'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': `${RECV_WINDOW}`, 'Content-Type': 'application/json',
    },
  });
  const { data } = await readResponse(response);
  if (data.retCode != null && data.retCode !== 0) throw new Error(data.retMsg || `Bybit ${data.retCode}`);
  return data.result;
}

export async function p2pReq(
  method: string, endpoint: string, params: ApiParams, key: string, secret: string,
): Promise<any> {
  const timestamp = Date.now().toString();
  const pStr = qs(normalizeParams(params));
  const sig = hmac(`${timestamp}${key}${RECV_WINDOW}${pStr}`, secret);
  const response = await fetch(`${BYBIT_P2P_URL}${endpoint}${pStr ? `?${pStr}` : ''}`, {
    method,
    headers: {
      'X-BAPI-API-KEY': key, 'X-BAPI-SIGN': sig,
      'X-BAPI-SIGN-TYPE': '2', 'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': `${RECV_WINDOW}`, 'Content-Type': 'application/json',
    },
  });
  const { data } = await readResponse(response);
  if (data.ret_code && data.ret_code !== 0) {
    const e = new Error(data.ret_msg || `Bybit P2P ${data.ret_code}`) as any;
    e.retCode = data.ret_code;
    e.ipError = data.ret_code === 10010;
    e.authError = data.ret_code === 10003;
    throw e;
  }
  return data;
}