'use client';

import { useState, useEffect, useCallback } from 'react';
import ProposalCard from './ProposalCard';

export default function ProposalQueue({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [message, setMessage] = useState('');

  const fetchProposals = useCallback(async () => {
    const statusParam = tab === 'pending' ? '&status=pending' : '';
    const res = await fetch(`/api/intel/focus-proposals?orgId=${orgId}${statusParam}`, { cache: 'no-store' });
    if (res.ok) setProposals(await res.json());
    setLoading(false);
  }, [orgId, tab]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  async function generate() {
    setGenerating(true);
    setMessage('');
    const res = await fetch('/api/intel/agent/propose-focus-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessage(`Generated ${data.length} proposals`);
      fetchProposals();
    } else {
      setMessage('Generation failed');
    }
    setGenerating(false);
  }

  async function handleAction(id: string, action: 'approve' | 'reject') {
    const res = await fetch(`/api/intel/focus-proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setProposals(prev => prev.map(p => p.id === id ? { ...p, status: action === 'approve' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() } : p));
    }
  }

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div>
      {message && <div className="mb-4 p-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm" style={{ color: 'var(--intel-primary)' }}>{message}</div>}

      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1">
          <button onClick={() => setTab('pending')} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${tab === 'pending' ? 'bg-white/10 text-white' : 'text-white/50'}`}>
            Pending ({proposals.filter(p => p.status === 'pending').length})
          </button>
          <button onClick={() => setTab('all')} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${tab === 'all' ? 'bg-white/10 text-white' : 'text-white/50'}`}>All</button>
        </div>
        {isAdmin && (
          <button onClick={generate} disabled={generating} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--intel-primary)' }}>
            {generating ? 'Generating...' : 'Generate Proposals'}
          </button>
        )}
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          {tab === 'pending' ? 'No pending proposals.' : 'No proposals yet. Click "Generate Proposals" to get started.'}
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.filter(p => tab === 'all' || p.status === 'pending').map(p => (
            <ProposalCard key={p.id} proposal={p} onAction={handleAction} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
