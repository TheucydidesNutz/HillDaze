'use client';

import { useState, useEffect, useCallback } from 'react';
import TrendReport from './TrendReport';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function TrendList({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trends, setTrends] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  const fetchTrends = useCallback(async () => {
    const res = await fetch(`/api/intel/agent/trend-analysis?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) setTrends(await res.json());
  }, [orgId]);
  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  async function generate() {
    setGenerating(true);
    setMessage('');
    const res = await fetch('/api/intel/agent/trend-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setTrends(prev => [...data, ...prev]);
      setMessage(`Generated ${data.length} trend reports`);
    } else {
      setMessage('Generation failed');
    }
    setGenerating(false);
  }

  return (
    <div>
      {message && <div className="mb-4 p-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm" style={{ color: 'var(--intel-primary)' }}>{message}</div>}

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>{trends.length} trend report{trends.length !== 1 ? 's' : ''}</p>
        {isAdmin && (
          <div className="text-right">
            <button onClick={generate} disabled={generating} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--intel-primary)' }}>
              {generating ? 'Analyzing...' : 'Generate Trend Analysis'}
            </button>
            <p className="text-xs italic opacity-40 mt-1" style={{ color: 'var(--intel-text)' }}>Analyzes patterns across jurisdictions and agencies from the last 30 days of monitored data.</p>
          </div>
        )}
      </div>

      {trends.length === 0 ? (
        <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          No trend reports yet. Click &ldquo;Generate Trend Analysis&rdquo; to analyze recent developments.
        </div>
      ) : (
        <div className="space-y-3">{trends.map(t => <TrendReport key={t.id} trend={t} />)}</div>
      )}
    </div>
  );
}
