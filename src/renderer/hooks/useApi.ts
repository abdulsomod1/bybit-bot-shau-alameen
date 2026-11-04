import { useState, useEffect, useCallback } from 'react';
import {
  apiSettings, apiCredentials, apiAds, apiRules, apiRankings, apiLogs, apiBotState, apiPendingUpdates,
  checkApiHealth,
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
  const [pendingUpdates, setPendingUpdates] = useState<any[]>([]);
  const [apiServerOk, setApiServerOk] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        apiBotState.get(),
        apiAds.get(),
        apiRules.get(),
        apiRankings.get(),
        apiLogs.get(),
        apiCredentials.get(),
        apiSettings.get(),
        apiPendingUpdates.get(),
      ]);
      const [st, ad, rl, rk, lg, cr, se, pu] = results;

      const safe = (p: PromiseSettledResult<any>, fallback: any) =>
        p.status === 'fulfilled' ? p.value : fallback;

      const health = await checkApiHealth();
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      const unauthorized = rejected.some(
        result => /unauthorized/i.test(
          result.reason instanceof Error ? result.reason.message : String(result.reason),
        ),
      );
      const authError = rejected.find(
        result => /unauthorized/i.test(
          result.reason instanceof Error ? result.reason.message : String(result.reason),
        ),
      )?.reason;
      const requestError = rejected[0]?.reason;

      setApiServerOk(health.ok);
      if (!health.ok) {
        setApiError('API server is not responding. Please restart the bot using "node run-dev.js"');
      } else if (unauthorized) {
        const detail = authError instanceof Error ? authError.message : String(authError);
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        if (detail.includes('not configured')) {
          setApiError(isLocal
            ? 'The API is online, but OWNER_ACCESS_TOKEN_DEV is empty in the local server environment.'
            : 'The API is online, but OWNER_ACCESS_TOKEN is not configured in the environment of the Render service serving this domain.');
        } else {
          setApiError(isLocal
            ? 'The API is online but rejected the owner token. Check OWNER_ACCESS_TOKEN_DEV in your local .env, restart the server, and enter the same token in Settings.'
            : 'The API is online but rejected the owner token. The running Render service has a token configured, but it does not match the token saved in this browser. Check the service serving this exact domain, then use Change Token and re-enter its current OWNER_ACCESS_TOKEN value.');
        }
      } else if (rejected.length > 0) {
        const message = requestError instanceof Error ? requestError.message : String(requestError);
        setApiError(`API request failed: ${message}`);
      } else {
        setApiError(null);
      }

      setStatus(safe(st, null));
      setAds(safe(ad, []));
      setRules(safe(rl, []));
      setRankings(safe(rk, []));
      setLogs(safe(lg, []));
      setCredentials(safe(cr, { has_credentials: false }) ?? { has_credentials: false });
      setSettings(safe(se, null));
      setBotState(safe(st, null));
      setPendingUpdates(safe(pu, []));
    } catch (e) {
      console.error('[useApi] fetchAll error', e);
      setApiServerOk(false);
      setApiError(e instanceof Error ? e.message : 'API error');
    }
  }, []);

  const refreshPendingUpdates = useCallback(async () => {
    setPendingUpdates(await apiPendingUpdates.get());
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

  const approvePendingUpdate = useCallback(async (id: string) => {
    const result = await apiPendingUpdates.approve(id);
    await fetchAll();
    return result;
  }, [fetchAll]);

  const rejectPendingUpdate = useCallback(async (id: string) => {
    const result = await apiPendingUpdates.reject(id);
    await fetchAll();
    return result;
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

  const fetchAdsFromBybit = useCallback(async () => apiAds.fetch(), []);

  return {
    status, ads, rules, rankings, logs, credentials, settings, botState, pendingUpdates,
    fetchAll, saveCredentials, saveSettings, saveRule, deleteRule,
    toggleAdSelection, startBot, pauseBot, resumeBot, stopBot,
    approvePendingUpdate, rejectPendingUpdate, refreshPendingUpdates,
    refreshRankings, testCredentials, deleteCredentials, clearLogs, fetchAdsFromBybit,
    apiServerOk, apiError,
  };
}
