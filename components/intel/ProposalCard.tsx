'use client';

import { useState } from 'react';

const typeColors: Record<string, string> = {
  add_topic: 'bg-green-500/20 text-green-300',
  remove_topic: 'bg-red-500/20 text-red-300',
  reprioritize: 'bg-blue-500/20 text-blue-300',
  scope_change: 'bg-purple-500/20 text-purple-300',
  soul_doc_amendment: 'bg-orange-500/20 text-orange-300',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ProposalCard({ proposal, onAction, isAdmin }: { proposal: any; onAction: (id: string, action: 'approve' | 'reject') => void; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[proposal.proposal_type] || 'bg-white/10 text-white/60'}`}>
              {proposal.proposal_type?.replace('_', ' ')}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[proposal.status] || ''}`}>
              {proposal.status}
            </span>
          </div>
          <span className="text-[10px] opacity-30 shrink-0" style={{ color: 'var(--intel-text)' }}>
            {new Date(proposal.created_at).toLocaleDateString()}
          </span>
        </div>

        <p className="text-sm mb-2" style={{ color: 'var(--intel-text)' }}>{proposal.description}</p>

        <button onClick={() => setExpanded(!expanded)} className="text-[10px] opacity-40 hover:opacity-70 mb-2" style={{ color: 'var(--intel-text)' }}>
          {expanded ? 'Hide details' : 'Show rationale'}
        </button>

        {expanded && (
          <div className="space-y-3 mb-3">
            <div>
              <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Rationale</h4>
              <p className="text-xs opacity-70" style={{ color: 'var(--intel-text)' }}>{proposal.rationale}</p>
            </div>
            {proposal.supporting_evidence?.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Supporting Evidence</h4>
                <ul className="space-y-0.5">
                  {proposal.supporting_evidence.map((e: string, i: number) => (
                    <li key={i} className="text-xs opacity-60" style={{ color: 'var(--intel-text)' }}>&bull; {e}</li>
                  ))}
                </ul>
              </div>
            )}
            {proposal.reviewed_at && (
              <p className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>
                {proposal.status === 'approved' ? 'Approved' : 'Rejected'} on {new Date(proposal.reviewed_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {proposal.status === 'pending' && isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => onAction(proposal.id, 'approve')} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-green-600 hover:bg-green-500">Approve</button>
            <button onClick={() => onAction(proposal.id, 'reject')} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">Reject</button>
          </div>
        )}
      </div>
    </div>
  );
}
