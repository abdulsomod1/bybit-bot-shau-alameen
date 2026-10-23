import { useState } from 'react';
import { useApi } from '../hooks/useApi';
const SL: Record<string, string> = { match_1st: 'Match #1', match_2nd: 'Match #2', match_3rd: 'Match #3', under_1st: 'Under #1', under_2nd: 'Under #2', under_3rd: 'Under #3', monitor_only: 'Monitor', fixed_offset: 'Fixed' };
export default function Rules() {
  const { rules, saveRule, deleteRule } = useApi();
  const [f, setF] = useState({ name: '', direction: 'BUY', asset: 'USDT', fiatCurrency: 'USD', strategy: 'match_3rd', pricePrecision: 2, maxChangePercent: 5, minIntervalMs: 60000, enabled: true, dryRun: false, manualApproval: false });
  const [edit, setEdit] = useState<any>(null), [open, setOpen] = useState(false);
  const sub = async () => { if (!f.name) return; await saveRule({ ...f, id: edit?.id || `r_${Date.now()}` }); setOpen(false); setEdit(null); };
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold">Pricing Rules</h2><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Configure auto-pricing for your ads</p></div>
        <button onClick={() => { setF({ name: '', direction: 'BUY', asset: 'USDT', fiatCurrency: 'USD', strategy: 'match_3rd', pricePrecision: 2, maxChangePercent: 5, minIntervalMs: 60000, enabled: true, dryRun: false, manualApproval: false }); setEdit(null); setOpen(true); }} className="btn btn-primary text-sm">+ New Rule</button>
      </div>
      {open && (
        <div className="card">
          <h3 className="font-semibold mb-3">{edit ? 'Edit Rule' : 'New Rule'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Rule name (e.g. My Buy USDT)" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} />
            <select className="select" value={f.direction} onChange={e => setF(x => ({ ...x, direction: e.target.value }))}><option value="BUY">Buy</option><option value="SELL">Sell</option></select>
            <select className="select" value={f.asset} onChange={e => setF(x => ({ ...x, asset: e.target.value }))}><option>USDT</option><option>BTC</option><option>ETH</option><option>USDC</option></select>
            <select className="select" value={f.fiatCurrency} onChange={e => setF(x => ({ ...x, fiatCurrency: e.target.value }))}><option>USD</option><option>EUR</option><option>GBP</option><option>BRL</option><option>ARS</option><option>TRY</option></select>
            <select className="select col-span-2" value={f.strategy} onChange={e => setF(x => ({ ...x, strategy: e.target.value }))}>{Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input type="number" className="input" placeholder="Max % change/update" value={f.maxChangePercent} onChange={e => setF(x => ({ ...x, maxChangePercent: parseFloat(e.target.value) || 5 }))} />
            <input type="number" className="input" placeholder="Min interval (sec)" value={f.minIntervalMs / 1000} onChange={e => setF(x => ({ ...x, minIntervalMs: (parseInt(e.target.value) || 0) * 1000 }))} />
            <div className="col-span-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.enabled} onChange={e => setF(x => ({ ...x, enabled: e.target.checked }))} className="accent-blue-500" /> Enabled</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.dryRun} onChange={e => setF(x => ({ ...x, dryRun: e.target.checked }))} className="accent-blue-500" /> Dry Run</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.manualApproval} onChange={e => setF(x => ({ ...x, manualApproval: e.target.checked }))} className="accent-blue-500" /> Manual</label>
            </div>
          </div>
          <div className="flex gap-2 mt-3"><button onClick={sub} className="btn btn-primary text-sm">{edit ? 'Update' : 'Create'}</button><button onClick={() => setOpen(false)} className="btn btn-ghost text-sm">Cancel</button></div>
        </div>
      )}
      {rules.length === 0 ? <div className="card text-center py-10" style={{ color: 'var(--text-secondary)' }}>No rules. Click "+ New Rule" to create one.</div> : (
        <div className="space-y-2">{rules.map((r: any) => (
          <div key={r.id} className="card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`status-dot ${r.enabled ? 'running' : 'stopped'}`} style={{ margin: 0 }}></span>
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="flex gap-2 mt-1">
                  <span className={`badge ${r.direction === 'BUY' ? 'badge-success' : 'badge-danger'}`}>{r.direction}</span>
                  <span className="badge badge-info">{SL[r.strategy] || r.strategy}</span>
                  {r.dryRun && <span className="badge badge-warning">Dry Run</span>}
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.asset}/{r.fiatCurrency} · {r.maxChangePercent}%/upd · {r.minIntervalMs / 1000}s</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2"><button onClick={() => { setF(r); setEdit(r); setOpen(true); }} className="btn btn-ghost text-sm">Edit</button><button onClick={() => deleteRule(r.id)} className="btn btn-danger text-sm">Delete</button></div>
          </div>
        ))}</div>
      )}
    </div>
  );
}