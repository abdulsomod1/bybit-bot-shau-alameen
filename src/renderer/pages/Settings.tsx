
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

type TestResult = {
  error?: string;
  errorCode?: string;
  apiKeyPrefix?: string;
};

export default function Settings() {
  const {
    credentials,
    settings,
    saveCredentials,
    saveSettings,
  } = useApi();

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [pollingInterval, setPollingInterval] = useState(60);
  const [currentIP, setCurrentIP] = useState('Checking...');
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const hasCredentials = Boolean(
    credentials?.apiKey && credentials?.apiSecret
  );

  // Load existing credentials and settings.
  useEffect(() => {
    if (credentials) {
      setApiKey(credentials.apiKey || '');
      setApiSecret(credentials.apiSecret || '');
    }
  }, [credentials]);

  useEffect(() => {
    if (settings?.pollingIntervalMs) {
      setPollingInterval(
        Math.max(10, Math.min(
          3600,
          Math.round(settings.pollingIntervalMs / 1000)
        ))
      );
    }
  }, [settings]);

  // Retrieve the current IP without calling the bridge during rendering.
  useEffect(() => {
    let active = true;

    const loadIP = async () => {
      try {
        const result = await (window as any).api?.getCurrentIP?.();

        if (active) {
          setCurrentIP(
            typeof result === 'string'
              ? result
              : result?.ip || 'IP unavailable'
          );
        }
      } catch (error) {
        if (active) {
          setCurrentIP('Unable to retrieve IP');
        }

        console.error('Could not retrieve current IP:', error);
      }
    };

    void loadIP();

    return () => {
      active = false;
    };
  }, []);

  const saveCreds = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setSaveError('Please enter both API Key and API Secret.');
      return;
    }

    setSaveError('');
    setSaved(false);

    try {
      const result = await saveCredentials({
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
      });

      if (result?.success) {
        setSaved(true);
        setSaveError('');
      } else {
        setSaveError(
          'Save failed: ' + (result?.error || 'Unknown error')
        );
      }
    } catch (error) {
      console.error('Saving credentials failed:', error);
      setSaveError(
        error instanceof Error ? error.message : 'Could not save credentials.'
      );
    }
  };

  const saveSett = async () => {
    setSettingsMessage('');

    if (!Number.isFinite(pollingInterval) ||
        pollingInterval < 10 ||
        pollingInterval > 3600) {
      setSettingsMessage('Enter an interval between 10 and 3600 seconds.');
      return;
    }

    try {
      const result = await saveSettings({
        pollingIntervalMs: pollingInterval * 1000,
      });

      if (result?.success === false) {
        setSettingsMessage(
          'Settings could not be saved: ' +
          (result?.error || 'Unknown error')
        );
      } else {
        setSettingsMessage('Settings saved successfully.');
      }
    } catch (error) {
      console.error('Saving settings failed:', error);
      setSettingsMessage(
        error instanceof Error ? error.message : 'Could not save settings.'
      );
    }
  };

  const testConn = async () => {
    setTestStatus('testing');
    setTestResult(null);

    try {
      const api = (window as any).api;

      if (typeof api?.testConnection !== 'function') {
        throw new Error(
          'The testConnection API is unavailable. Check the Electron preload bridge.'
        );
      }

      const result = await api.testConnection();

      if (result?.success) {
        setTestStatus('success');
        setTestResult({ apiKeyPrefix: result.apiKeyPrefix });
      } else {
        setTestStatus('error');
        setTestResult({
          error: result?.error || 'Connection failed.',
          errorCode: result?.errorCode,
        });
      }
    } catch (error) {
      console.error('Testing the Bybit connection failed:', error);
      setTestStatus('error');
      setTestResult({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('Clear all logs?')) return;

    try {
      const api = (window as any).api;

      if (typeof api?.clearLogs !== 'function') {
        setSettingsMessage('The clear logs API is unavailable.');
        return;
      }

      await api.clearLogs();
      setSettingsMessage('Clear logs request completed.');
    } catch (error) {
      console.error('Clearing logs failed:', error);
      setSettingsMessage(
        error instanceof Error ? error.message : 'Could not clear logs.'
      );
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p
          className="text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          Configure API keys and bot behavior.
        </p>
      </div>

      <section className="card">
        <h3 className="font-semibold mb-1">Bybit API Credentials</h3>

        <p
          className="text-xs mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          Your API credentials are intended to be stored locally.
          Use only the permissions your bot requires, and never share
          your API Secret.
        </p>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="bybit-api-key"
              className="text-xs mb-1 block"
              style={{ color: 'var(--text-secondary)' }}
            >
              API Key
            </label>

            <input
              id="bybit-api-key"
              className="input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Bybit API key"
              autoComplete="off"
            />
          </div>

          <div>
            <label
              htmlFor="bybit-api-secret"
              className="text-xs mb-1 block"
              style={{ color: 'var(--text-secondary)' }}
            >
              API Secret
            </label>

            <input
              id="bybit-api-secret"
              className="input"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Enter your Bybit API secret"
              autoComplete="new-password"
            />
          </div>

          {saveError && (
            <div role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>
              ⚠ {saveError}
            </div>
          )}

          <div className="flex gap-2 items-center flex-wrap">
            <button
              type="button"
              onClick={saveCreds}
              className="btn btn-primary text-sm"
              style={{ minWidth: 140 }}
            >
              {saved ? '✅ Saved!' : '💾 Save Credentials'}
            </button>

            {hasCredentials && (
              <button
                type="button"
                onClick={testConn}
                className="btn btn-ghost text-sm"
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing'
                  ? '⏳ Testing...'
                  : '🔗 Test Connection'}
              </button>
            )}

            {!hasCredentials && (
              <span
                className="text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                Save credentials first, then test the connection.
              </span>
            )}
          </div>

          {testStatus === 'success' && testResult && (
            <div
              role="status"
              className="mt-2 p-3 rounded text-sm"
              style={{
                background: 'rgba(34,197,94,0.1)',
                color: 'var(--success)',
              }}
            >
              <strong>✅ Connection successful!</strong>
              <p>API Key: {testResult.apiKeyPrefix || 'Verified'}</p>
            </div>
          )}

          {testStatus === 'error' && testResult && (
            <div
              role="alert"
              className="mt-2 p-3 rounded text-sm"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--danger)',
              }}
            >
              <strong>❌ Connection failed</strong>
              <p>{testResult.error}</p>

              {testResult.errorCode && (
                <p className="font-mono mt-1">
                  Error code: {testResult.errorCode}
                </p>
              )}

              {testResult.errorCode?.startsWith('ERR_IP') && (
                <p
                  className="mt-1 text-xs"
                  style={{ color: 'var(--warning)' }}
                >
                  Check the IP whitelist configured for your Bybit API key.
                </p>
              )}

              {testResult.errorCode?.startsWith('ERR_AUTH') && (
                <p
                  className="mt-1 text-xs"
                  style={{ color: 'var(--warning)' }}
                >
                  Check your API Key and Secret.
                </p>
              )}
            </div>
          )}

          {hasCredentials && (
            <p style={{ color: 'var(--success)', fontSize: 12 }}>
              ✓ Credentials are available. You can test the connection.
            </p>
          )}
        </div>

        <div
          className="mt-3 text-xs p-2 rounded"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--warning)',
          }}
        >
          ⚠ IP status: Add your current public IP to the API key whitelist
          if required. Current IP:{' '}
          <span className="font-mono">{currentIP}</span>
        </div>
      </section>

      <section className="card">
        <h3 className="font-semibold mb-1">Bot Behavior</h3>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="polling-interval"
              className="text-xs mb-1 block"
              style={{ color: 'var(--text-secondary)' }}
            >
              Polling Interval (seconds)
            </label>

            <input
              id="polling-interval"
              type="number"
              className="input w-40"
              value={pollingInterval}
              onChange={(e) =>
                setPollingInterval(
                  e.target.value === '' ? 0 : Number(e.target.value)
                )
              }
              min={10}
              max={3600}
            />

            <p
              className="text-xs mt-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              How often the bot checks competitors and updates prices
              (10–3600 seconds).
            </p>
          </div>

          <button
            type="button"
            onClick={saveSett}
            className="btn btn-primary text-sm"
          >
            Save Settings
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="font-semibold mb-1">Data Management</h3>

        <div className="space-y-3">
          <button
            type="button"
            onClick={clearLogs}
            className="btn btn-ghost text-sm"
          >
            Clear Logs
          </button>
        </div>

        <div
          className="mt-4 p-3 rounded text-xs"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
          }}
        >
          <p><strong>Version:</strong> Bybit P2P Bot v1.0.0</p>
          <p>
            <strong>Storage:</strong> Local application storage is intended
            for settings and credentials. Verify your backend storage and
            encryption implementation.
          </p>
        </div>
      </section>

      {settingsMessage && (
        <p
          role="status"
          className="text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          {settingsMessage}
        </p>
      )}
    </div>
  );
}
