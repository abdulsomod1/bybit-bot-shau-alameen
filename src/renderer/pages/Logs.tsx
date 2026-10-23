import { useState } from 'react';
import { useApi } from '../hooks/useApi';

const LEVEL_COLORS: Record<string, string> = { info: 'var(--accent)', success: 'var(--success)', warning: 'var(--warning)', error: 'var(--danger)', debug: 'var(--text-secondary)' };
const CAT_ICONS: Record<string, string> = { bot: '🤖', monitoring: '📊', pricing: '💰', safety: '🛡️', ip: '🌐', ads: '📋', auth: '🔑' };

export default function Logs() {
  const { logs } = useApi();
  const [filter, setFilter] = useState({ level: 'all', category: 'all', search: '' });
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;
  const filtered = logs.filter(l => {
    if (filter.level !== 'all' && l.level !== filter.level) return false;
    if (filter.category !== 'all' && l.category !== filter.category) return false;
    if (filter.search && !`${l.message} ${l.details || ''} ${l.category}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const cats = [...new Set(logs.map(l => l.category))];
  const fmt = (iso: string) => iso ? new Date(iso).toLocaleString() : '—';

  return (
    <div className="space-y-4">
      <div><h2 className="text-2xl font-bold">Activity Log</h2><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{filtered.length} log entries</p></div>
      <div className="flex gap-2 flex-wrap">
        <input className="input max-w-xs text-sm" placeholder="Search logs..." value={filter.search} onChange={e => { setFilter(f => ({ ...f, search: e.target.value })); setPage(0); }} />
        <select className="select w-32 text-sm" value={filter.level} onChange={e => { setFilter(f => ({ ...f, level: e.target.value })); setPage(0); }}>
          <option value="all">All Levels</option><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="error">Error</option>
        </select>
        <select className="select w-40 text-sm" value={filter.category} onChange={e => { setFilter(f => ({ ...f, category: e.target.value })); setPage(0); }}>
          <option value="all">All Categories</option>{cats.map(c => <option key={c} value={c}>{CAT_ICONS[c] || '📁'} {c}</option>)}
        </select>
        <button onClick={async () => { await (window as any).api?.clearLogs(); window.location.reload(); }} className="btn btn-ghost text-sm ml-auto">Clear Logs</button>
      </div>
      {filtered.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--text-secondary)' }}>No logs match your filters.</div>
      ) : (
        <div className="space-y-1">
          {paged.map((l: any, i: number) => (
            <div key={l.id || i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors" style={{ background: l.level === 'error' ? 'rgba(239,68,68,0.05)' : l.level === 'warning' ? 'rgba(245,158,11,0.05)' : 'var(--bg-secondary)' }}>
              <span className="text-xs shrink-0 mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{fmt(l.timestamp)}</span>
              <span className="text-sm shrink-0 w-14 text-center font-medium" style={{ color: LEVEL_COLORS[l.level] || 'var(--text-primary)' }}>{l.level?.toUpperCase()}</span>
              <span className="text-sm shrink-0 w-20 text-center">{CAT_ICONS[l.category] || '📁'} <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{l.category}</span></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm">{l.message}</div>
                {l.details && <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{l.details}</div>}
                {(l.previousValue || l.newValue) && <div className="text-xs mt-1 font-mono">
                  {l.previousValue && <span style={{ color: 'var(--danger)' }}>was: {l.previousValue}</span>}
                  {l.previousValue && l.newValue && ' → '}
                  {l.newValue && <span style={{ color: 'var(--success)' }}>now: {l.newValue}</span>}
                </div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {filtered.length > PER_PAGE && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn btn-ghost text-sm">← Prev</button>
          <span className="flex items-center text-sm" style={{ color: 'var(--text-secondary)' }}>Page {page + 1} of {Math.ceil(filtered.length / PER_PAGE)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PER_PAGE >= filtered.length} className="btn btn-ghost text-sm">Next →</button>
        </div>
      )}
    </div>
  );
}