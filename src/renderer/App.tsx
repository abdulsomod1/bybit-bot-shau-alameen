import { useEffect } from 'react';
import { useApi } from './hooks/useApi';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Ads from './pages/Ads';
import Rules from './pages/Rules';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import { useAppStore } from './store/appStore';

const pages: Record<string, React.ComponentType> = { dashboard: Dashboard, ads: Ads, rules: Rules, settings: Settings, logs: Logs };

export default function App() {
  const { page, setStatus, setAds, setLogs, setRules, setRankings, setCredentials, setSettings, setBotState } = useAppStore();
  const api = useApi();

  // Sync API state → appStore whenever any api property changes
  useEffect(() => {
    if (api.status) setStatus(api.status);
    if (api.ads) setAds(api.ads);
    if (api.logs) setLogs(api.logs);
    if (api.rules) setRules(api.rules);
    if (api.rankings) setRankings(api.rankings);
    if (api.credentials) setCredentials(api.credentials);
    if (api.settings) setSettings(api.settings);
    if (api.botState) setBotState(api.botState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.status, api.ads, api.logs, api.rules, api.rankings, api.credentials, api.settings, api.botState]);

  const Page = pages[page] || Dashboard;
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Page />
      </main>
    </div>
  );
}

