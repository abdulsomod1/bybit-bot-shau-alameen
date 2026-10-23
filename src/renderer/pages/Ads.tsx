import { useState } from 'react';
import { useApi } from '../hooks/useApi';

export default function Ads() {
  const { ads, toggleAdSelection } = useApi();
  const [filter, setFilter] = useState({ status: 'all', direction: 'all', search: '' });
  const filtered = ads.filter(a => {
    if (filter.status !== 'all' && a.status !== filter.status) return false;
    if (filter.direction !== 'all' && a.direction !== filter.direction) return false;
    if (filter.search && !`${a.price} ${a.asset} ${a.fiatCurrency} ${a.nickname} ${a.userId}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">Advertisements</h2><p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Select which ads the bot should manage</p></div>

      <div className="flex gap-3">
        <input className="input max-w-xs" placeholder="Search ads..." value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
        <select className="select w-40" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="all">All Status</option><option value="online">Online</option><option value="offline">Offline</option><option value="editing">Editing</option>
        </select>
        <select className="select w-40" value={filter.direction} onChange={e => setFilter(f => ({ ...f, direction: e.target.value }))}>
          <option value="all">All Directions</option><option value="BUY">Buy</option><option value="SELL">Sell</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--text-secondary)' }}>
          No advertisements found. Connect your Bybit API key in Settings and sync your ads.
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table>
            <thead><tr>
              <th className="w-12"><input type="checkbox" className="accent-blue-500" disabled /></th>
              <th>Ad</th><th>Direction</th><th>Price</th><th>Min/Max</th><th>Status</th><th>Payments</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(ad => (
                <tr key={ad.id}>
                  <td><input type="checkbox" checked={ad.isSelected} onChange={e => toggleAdSelection(ad.id, e.target.checked)} className="accent-blue-500 cursor-pointer" /></td>
                  <td>
                    <div className="font-medium text-sm">{ad.asset || 'USDT'}/{ad.fiatCurrency || 'USD'}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>ID: {ad.id}</div>
                  </td>
                  <td><span className={`badge ${ad.direction === 'BUY' ? 'badge-success' : 'badge-danger'}`}>{ad.direction}</span></td>
                  <td><span className="font-mono font-bold">{ad.price ?? '—'}</span></td>
                  <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ad.minAmount ?? '—'} / {ad.maxAmount ?? '—'}</td>
                  <td>
                    <span className={`badge ${ad.status === 'online' ? 'badge-success' : ad.status === 'offline' ? 'badge-neutral' : 'badge-warning'}`}>{ad.status}</span>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(ad.paymentMethods || []).slice(0, 2).map((p: any) => p.name).join(', ') || '—'}</td>
                  <td>
                    <button onClick={() => toggleAdSelection(ad.id, !ad.isSelected)}
                      className={`btn text-xs py-1 px-2 ${ad.isSelected ? 'btn-success' : 'btn-ghost'}`}>
                      {ad.isSelected ? '✓ Managed' : '+ Manage'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card text-sm" style={{ color: 'var(--text-secondary)' }}>
        <strong className="text-[var(--text-primary)]">Tip:</strong> Select ads you want the bot to automatically manage. The bot will only update prices for selected ads that match your pricing rules.
      </div>
    </div>
  );
}