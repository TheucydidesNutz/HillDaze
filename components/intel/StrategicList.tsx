'use client';

import { useState, useEffect, useCallback } from 'react';
import StrategicCard from './StrategicCard';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StrategicList({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/intel/agent/strategic-review?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) setItems(await res.json());
  }, [orgId]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function generate() {
    setGenerating(true);
    setMessage('');
    const res = await fetch('/api/intel/agent/strategic-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems(prev => [...data, ...prev]);
      setMessage(`Generated ${data.length} strategic recommendations`);
    } else {
      setMessage('Generation failed');
    }
    setGenerating(false);
  }

  function handleStatusChange(id: string, status: string) {
    setItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...items].sort((a, b) => ((priorityOrder as Record<string, number>)[a.priority] || 3) - ((priorityOrder as Record<string, number>)[b.priority] || 3));
  const filtered = filter === 'all' ? sorted : sorted.filter(r => r.status === filter);

  return (
    <div>
      {message && <div className="mb-4 p-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm" style={{ color: 'var(--intel-primary)' }}>{message}</div>}

      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1">
          {['all', 'new', 'acknowledged', 'in_progress', 'completed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${filter === f ? 'bg-white/10 text-white' : 'text-white/50'}`}>{f === 'all' ? 'All' : f.replace('_', ' ')}</button>
          ))}
        </div>
        {isAdmin && (
          <div className="text-right">
            <button onClick={generate} disabled={generating} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--intel-primary)' }}>
              {generating ? 'Generating...' : 'Generate Strategic Review'}
            </button>
            <p className="text-xs italic opacity-40 mt-1" style={{ color: 'var(--intel-text)' }}>Produces actionable recommendations based on upcoming deadlines, stakeholder activity, and current priorities.</p>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          {items.length === 0 ? 'No strategic recommendations yet. Click "Generate Strategic Review" to get started.' : 'No items match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">{filtered.map(r => <StrategicCard key={r.id} rec={r} onStatusChange={handleStatusChange} />)}</div>
      )}
    </div>
  );
}
