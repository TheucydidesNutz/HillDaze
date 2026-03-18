'use client';

import { useState, useEffect, useCallback } from 'react';
import RecommendationCard from './RecommendationCard';
import DraftViewer from './DraftViewer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RecommendationList({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewingDraft, setViewingDraft] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchRecs = useCallback(async () => {
    const res = await fetch(`/api/intel/agent/generate-recommendations?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) setRecs(await res.json());
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchRecs(); }, [fetchRecs]);

  async function generate() {
    setGenerating(true);
    setMessage('');
    const res = await fetch('/api/intel/agent/generate-recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setRecs(prev => [...data, ...prev]);
      setMessage(`Generated ${data.length} recommendations`);
    } else {
      setMessage('Generation failed');
    }
    setGenerating(false);
  }

  async function handleDraft(id: string) {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, status: 'draft_requested' } : r));
    const res = await fetch('/api/intel/agent/draft-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation_id: id }),
    });
    if (res.ok) {
      const data = await res.json();
      setRecs(prev => prev.map(r => r.id === id ? { ...r, status: 'draft_complete', draft_content: data.draft } : r));
    }
  }

  function handleArchive(id: string) {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, status: 'archived' } : r));
  }

  const filtered = filter === 'all' ? recs : recs.filter(r => r.status === filter);

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div>
      {message && <div className="mb-4 p-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm" style={{ color: 'var(--intel-primary)' }}>{message}</div>}

      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1">
          {['all', 'pitched', 'draft_complete', 'archived'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${filter === f ? 'bg-white/10 text-white' : 'text-white/50'}`}>{f === 'all' ? 'All' : f.replace('_', ' ')}</button>
          ))}
        </div>
        {isAdmin && (
          <div className="text-right">
            <button onClick={generate} disabled={generating} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--intel-primary)' }}>
              {generating ? 'Generating...' : 'Generate Recommendations'}
            </button>
            <p className="text-xs italic opacity-40 mt-1" style={{ color: 'var(--intel-text)' }}>Scans recent news, documents, and your priorities to propose 3–5 timely article concepts.</p>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          {recs.length === 0 ? 'No recommendations yet. Click "Generate Recommendations" to get started.' : 'No items match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => <RecommendationCard key={r.id} rec={r} onDraft={handleDraft} onArchive={handleArchive} onViewDraft={setViewingDraft} />)}
        </div>
      )}

      {viewingDraft && <DraftViewer title={viewingDraft.title} draft={viewingDraft.draft_content} onClose={() => setViewingDraft(null)} />}
    </div>
  );
}
