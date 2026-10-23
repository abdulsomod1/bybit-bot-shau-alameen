
import { useAppStore } from '../../store/appStore';

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    id: 'ads',
    label: 'Advertisements',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    id: 'rules',
    label: 'Pricing Rules',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    id: 'logs',
    label: 'Activity Log',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

export default function Sidebar() {
  const { page, setPage, status, credentials } = useAppStore();

  const isRunning = status?.status === 'running';
  const isPaused = status?.status === 'paused';

  const handleNavigation = (pageId: string) => {
    console.log('Clicked navigation:', pageId);

    setPage(pageId);

    console.log(
      'Page state after click:',
      useAppStore.getState().page
    );
  };

  return (
    <aside
      className="w-64 flex flex-col border-r border-[var(--border)] h-full shrink-0"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <div className="p-5 border-b border-[var(--border)]">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <span style={{ color: 'var(--accent)' }}>⟨⟩</span>
          Bybit P2P Bot
        </h1>

        <p
          className="text-xs mt-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          {isRunning
            ? '🟢 Running'
            : isPaused
              ? '🟡 Paused'
              : '⚪ Stopped'}

          {status?.currentIP && (
            <span className="block text-xs mt-0.5 opacity-60">
              IP: {status.currentIP}
            </span>
          )}
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavigation(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              page === item.id
                ? 'text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={
              page === item.id
                ? { background: 'var(--accent)' }
                : {}
            }
          >
            <svg
              className="w-5 h-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={item.icon}
              />
            </svg>

            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--border)]">
        <div
          className="text-xs p-3 rounded-lg"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <div className="font-medium mb-1">API Status</div>

          <div style={{ color: 'var(--text-secondary)' }}>
            {credentials ? (
              <span className="text-[var(--success)] text-xs">
                ✓ Connected
              </span>
            ) : (
              <span className="text-[var(--danger)] text-xs">
                ⚠ Not configured
              </span>
            )}
          </div>

          {status?.updateCount !== undefined && (
            <div
              className="mt-1 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Updates: {status.updateCount}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
