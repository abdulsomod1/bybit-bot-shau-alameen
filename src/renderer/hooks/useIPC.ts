import { useEffect } from 'react';

export function useIPC({ setStatus, setAds, setLogs, setRankings }: any) {
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) return;
    const cleanups = [
      api.on('bot-status-changed', (data: any) => setStatus?.(data)),
      api.on('ads-updated', (ads: any) => setAds?.(ads)),
      api.on('logs-updated', (logs: any) => setLogs?.(logs)),
      api.on('rankings-updated', (rankings: any) => setRankings?.(rankings)),
      api.on('pending-update', (data: any) => { if (confirm(`Pending: Ad ${data.adId} -> ${data.targetPrice} (rule: ${data.ruleName}). Apply?`)) api.approvePendingUpdate(data.adId); }),
    ];
    return () => cleanups.forEach((fn: () => void) => fn?.());
  }, []);
}
