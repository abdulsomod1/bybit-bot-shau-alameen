import { useApi } from '../hooks/useApi';

export default function Dashboard() {
  const { status, ads, rankings, rules, botState, startBot, pauseBot, resumeBot, stopBot, refreshRankings } = useApi();
  const isRunning = status?.status === 'running', isPaused = status?.status === 'paused';
  const selAds = ads.filter((a: any) => a.isSelected);
  const enRules = rules.filter((r: any) => r.enabled);
  const fmt = (iso: string) => iso ? new Date(iso).toLocaleTimeString() : '—';
  const fmtD = (iso: string) => iso ? new Date(iso).toLocaleString() : '—';
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold">Dashboard</h2><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>P2P Bot Monitor</p></div>
        <div className="flex gap-2">
          <button onClick={refreshRankings} className="btn btn-ghost text-sm">⟳ Refresh</button>
          {isRunning ? <button onClick={pauseBot} className="btn btn-ghost text-sm" style={{ color: 'var(--warning)' }}>⏸ Pause</button>
           : isPaused ? <><button onClick={resumeBot} className="btn btn-success text-sm">▶ Resume</button><button onClick={stopBot} className="btn btn-danger text-sm">■ Stop</button></>
           : <button onClick={startBot} className="btn btn-primary text-sm">▶ Start Bot</button>}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[{ l: 'Status', v: isRunning ? 'Running' : isPaused ? 'Paused' : 'Stopped', c: isRunning ? 'var(--success)' : isPaused ? 'var(--warning)' : 'var(--text-secondary)' },
          { l: 'Selected Ads', v: selAds.length, s: `${ads.length} total` },
          { l: 'Active Rules', v: enRules.length, s: `${rules.length} total` },
          { l: 'Updates', v: botState?.update_count ?? 0, s: `Err: ${botState?.error_count ?? 0}` },
        ].map((s, i) => <div key={i} className="card"><div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>{s.l}</div><div className="text-2xl font-bold" style={{ color: s.c || 'var(--accent)' }}>{s.v}</div>{s.s && <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{s.s}</div>}</div>)}
      </div>
      {(status?.lastUpdate || status?.lastSuccessfulUpdate) && (
        <div className="card text-sm flex gap-6" style={{ color: 'var(--text-secondary)' }}>
          <span>Refresh: <span style={{ color: 'var(--text-primary)' }}>{fmt(status.lastUpdate)}</span></span>
          <span>Success: <span style={{ color: 'var(--success)' }}>{fmt(status.lastSuccessfulUpdate)}</span></span>
          {status?.currentIP && <span>IP: <span className="font-mono" style={{ color: 'var(--accent)' }}>{status.currentIP}</span></span>}
        </div>)}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Market Rankings</h3>
        {rankings.length === 0 ? <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>No rankings. Start the bot.</div> :
        <div className="space-y-3">
          {rankings.map((r: any) => {
            const [p1, p2, p3] = [r.firstRanked, r.secondRanked, r.thirdRanked];
            return (
            <div key={r.marketKey} className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">{r.direction} {r.asset}/{r.fiatCurrency}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{r.dataStale ? '⚠' : '✓'} {r.competitors?.length || 0} comps · {fmtD(r.lastRefresh)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {[{ c: p1, n: 1 }, { c: p2, n: 2 }, { c: p3, n: 3 }].map(({ c, n }) => (
                  <div key={n} className={`p-2 rounded ${n === 3 ? 'border border-blue-500/30' : ''}`} style={{ background: n === 3 ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>#{n}{n === 3 ? ' (target)' : ''}</div>
                    <div className="font-mono font-bold" style={{ color: n === 3 ? 'var(--accent)' : 'var(--text-primary)' }}>{c?.price ?? '—'}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{c?.nickname || '—'}</div>
                  </div>
                ))}
              </div>
            </div>);
          })}
        </div>}
      </div>
      {enRules.length > 0 && <div className="card"><h3 className="text-lg font-semibold mb-3">Active Rules</h3><div className="space-y-2">{enRules.map((rule: any) => (
        <div key={rule.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
          <span className="font-medium text-sm">{rule.name}</span>
          <span className="badge badge-info">{rule.strategy}</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{rule.direction} {rule.asset}/{rule.fiatCurrency} · {rule.targetPosition} · {rule.priceOffset}%</span>
        </div>
      ))}</div></div>}
      <div className="card"><h3 className="text-lg font-semibold mb-2">IP Info</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>Current: <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{status?.currentIP || '—'}</span></div>
          <div>Saved: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{botState?.last_working_ip || '—'}</span></div>
        </div>
        <div className="mt-2 text-xs p-2 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>⚠ Ensure this IP is whitelisted in your Bybit API key.</div>
      </div>
    </div>
  );
}