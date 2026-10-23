const IP_CHECK_URLS = ['https://api.ipify.org', 'https://api4.ipify.org', 'https://icanhazip.com', 'https://ifconfig.me/ip'];

export async function getCurrentPublicIP(): Promise<string> {
  for (const url of IP_CHECK_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const ip = (await res.text()).trim();
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
    } catch { continue; }
  }
  return 'unknown';
}

export function isIPWhitelistError(data: any): boolean {
  const code = data?.ret_code || data?.code;
  return code === 10003 || code === 10007 || code === 10012 || (data?.ret_msg || '').toLowerCase().includes('ip') || (data?.msg || '').toLowerCase().includes('ip');
}
