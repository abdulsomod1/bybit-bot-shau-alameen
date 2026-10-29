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
  const [apiServerOk, setApiServerOk] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

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

      // Detect auth errors (401 = missing/invalid owner token)
      const authError = (v: any) =>
        v && typeof v === 'object' && (v.unauthorized || (v.error && v.error.includes('Unauthorized')));

      // Check if any API call failed due to server issues
      const hasServerError = [st, ad, rl, rk, lg, cr, se, bs].some(
        p => p.status === 'rejected' || 
            (p.status === 'fulfilled' && p.value?.error?.includes('Cannot connect') || p.value?.error?.includes('Express'))
      );

      if (hasServerError) {
        setApiServerOk(false);
        setApiError('API server is not responding. Please restart the bot using "node run-dev.js"');
      } else {
        setApiServerOk(true);
        setApiError(null);
      }

      setStatus(authError(safe(st, null)) ? null : safe(st, null));
      setAds(authError(safe(ad, null)) ? [] : safe(ad, []));
      setRules(authError(safe(rl, null)) ? [] : safe(rl, []));
      setRankings(authError(safe(rk, null)) ? [] : safe(rk, []));
      setLogs(authError(safe(lg, null)) ? [] : safe(lg, []));
      setCredentials(authError(safe(cr, null)) ? { has_credentials: false, unauthorized: true } : (safe(cr, { has_credentials: false }) ?? { has_credentials: false }));
      setSettings(authError(safe(se, null)) ? null : safe(se, null));
      setBotState(authError(safe(bs, null)) ? null : safe(bs, null));
    } catch (e) {
      console.error('[useApi] fetchAll error', e);
      setApiServerOk(false);
      setApiError(e instanceof Error ? e.message : 'API error');
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
      return apiSettings.save(data);
    },
    [],
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
    apiServerOk, apiError,
  };
}

