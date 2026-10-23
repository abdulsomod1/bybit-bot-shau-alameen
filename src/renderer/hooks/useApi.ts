import { useState, useEffect, useCallback } from 'react';
import {
  apiSettings, apiCredentials, apiAds, apiRules, apiRankings, apiLogs, apiBotState,
} from '../lib/api-client';

export function useApi() {
  const [status, setStatus] = useState<any>(null);
  const [ads, setAds] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [botState, setBotState] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [st, ad, rl, rk, lg, cr, se, bs] = await Promise.allSettled([
        apiBotState.get(),
        apiAds.get(),
        apiRules.get(),
        apiRankings.get(),
        apiLogs.get(),
        apiCredentials.get(),
        apiSettings.get(),
        apiBotState.get(),
      ]);

      const safe = (p: PromiseSettledResult<any>, fallback: any) =>
        p.status === 'fulfilled' ? p.value : fallback;

      setStatus(safe(st, null));
      setAds(safe(ad, []));
      setRules(safe(rl, []));
      setRankings(safe(rk, []));
      setLogs(safe(lg, []));
      setCredentials(safe(cr, { has_credentials: false }));
      setSettings(safe(se, {}));
      setBotState(safe(bs, null));
    } catch (e) {
      console.error('[useApi] fetchAll error', e);
    }
  }, []);

  // Auto-refetch when user changes
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveCredentials = useCallback(
    async (data: { apiKey: string; apiSecret: string }) => {
      const result = await apiCredentials.save(data.apiKey, data.apiSecret);
      fetchAll();
      return result;
    },
    [fetchAll],
  );

  const saveSettings = useCallback(
    async (data: Record<string, unknown>) => {
      await apiSettings.save(data);
      fetchAll();
    },
    [fetchAll],
  );

  const saveRule = useCallback(
    async (rule: Record<string, unknown>) => {
      await apiRules.save(rule);
      fetchAll();
    },
    [fetchAll],
  );

  const deleteRule = useCallback(
    async (id: string) => {
      await apiRules.delete(id);
      fetchAll();
    },
    [fetchAll],
  );

  const toggleAdSelection = useCallback(
    async (id: string, selected: boolean) => {
      await apiAds.select(id, selected);
      fetchAll();
    },
    [fetchAll],
  );

  const startBot = useCallback(async () => {
    await apiBotState.update({ status: 'running' });
    fetchAll();
  }, [fetchAll]);

  const pauseBot = useCallback(async () => {
    await apiBotState.update({ status: 'paused' });
    fetchAll();
  }, [fetchAll]);

  const resumeBot = useCallback(async () => {
    await apiBotState.update({ status: 'running' });
    fetchAll();
  }, [fetchAll]);

  const stopBot = useCallback(async () => {
    await apiBotState.update({ status: 'stopped' });
    fetchAll();
  }, [fetchAll]);

  const refreshRankings = useCallback(async () => {
    // Trigger a fresh fetch of rankings (server will re-fetch from Bybit)
    fetchAll();
  }, [fetchAll]);

  const testCredentials = useCallback(
    async (apiKey: string, apiSecret: string) => {
      return apiCredentials.test(apiKey, apiSecret);
    },
    [],
  );

  const deleteCredentials = useCallback(async () => {
    await apiCredentials.delete();
    fetchAll();
  }, [fetchAll]);

  const clearLogs = useCallback(async () => {
    await apiLogs.clear();
    fetchAll();
  }, [fetchAll]);

  const fetchAdsFromBybit = useCallback(
    async (apiKey: string, apiSecret: string) => {
      return apiAds.fetch(apiKey, apiSecret);
    },
    [],
  );

  return {
    status, ads, rules, rankings, logs, credentials, settings, botState,
    fetchAll, saveCredentials, saveSettings, saveRule, deleteRule,
    toggleAdSelection, startBot, pauseBot, resumeBot, stopBot,
    refreshRankings, testCredentials, deleteCredentials, clearLogs, fetchAdsFromBybit,
  };
}

