'use client';

import { useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RecommendationCard({ rec, onDraft, onArchive, onViewDraft }: { rec: any; onDraft: (id: string) => void; onArchive: (id: string) => void; onViewDraft: (rec: any) => void }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    pitched: 'bg-blue-500/20 text-blue-300',
    draft_requested: 'bg-yellow-500/20 text-yellow-300',
    draft_complete: 'bg-green-500/20 text-green-300',
    archived: 'bg-gray-500/20 text-gray-400',
  };

  const typeLabels: Record<string, string> = {
    op_ed: 'Op-Ed', think_piece: 'Think Piece', white_paper: 'White Paper',
    academic: 'Academic', blog: 'Blog', testimony: 'Testimony',
  };

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden hover:border-white/15 transition-colors">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--intel-text)' }}>{rec.title}</h3>
          <div className="flex gap-1.5 shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06]" style={{ color: 'var(--intel-primary)' }}>{typeLabels[rec.article_type] || rec.article_type}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[rec.status] || ''}`}>{rec.status?.replace('_', ' ')}</span>
          </div>
        </div>

        <p className="text-xs opacity-70 mb-3" style={{ color: 'var(--intel-text)' }}>{rec.thesis}</p>

        {rec.relevance_score != null && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${rec.relevance_score * 100}%`, backgroundColor: 'var(--intel-primary)' }} />
            </div>
            <span className="text-[10px] opacity-50" style={{ color: 'var(--intel-text)' }}>{(rec.relevance_score * 100).toFixed(0)}%</span>
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)} className="text-[10px] opacity-40 hover:opacity-70 mb-3" style={{ color: 'var(--intel-text)' }}>
          {expanded ? 'Hide details' : 'Show details'}
        </button>

        {expanded && (
          <div className="space-y-3 mb-3">
            {rec.key_arguments?.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Key Arguments</h4>
                <ul className="space-y-1">{rec.key_arguments.map((a: string, i: number) => (
                  <li key={i} className="text-xs opacity-70 flex gap-2" style={{ color: 'var(--intel-text)' }}><span className="opacity-40">{i + 1}.</span>{a}</li>
                ))}</ul>
              </div>
            )}
            {rec.timeliness && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Timeliness</h4>
                <p className="text-xs opacity-70" style={{ color: 'var(--intel-text)' }}>{rec.timeliness}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {rec.status === 'pitched' && (
            <div>
              <button onClick={() => onDraft(rec.id)} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Expand to Draft</button>
              <p className="text-xs italic opacity-40 mt-1" style={{ color: 'var(--intel-text)' }}>Uses our premium model to produce a 1,500–3,000 word first draft. Takes 30–60 seconds.</p>
            </div>
          )}
          {rec.status === 'draft_complete' && (
            <button onClick={() => onViewDraft(rec)} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>View Draft</button>
          )}
          {rec.status === 'draft_requested' && (
            <span className="px-3 py-1.5 text-xs text-yellow-400 flex items-center gap-1"><div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />Drafting...</span>
          )}
          {rec.status !== 'archived' && (
            <button onClick={() => onArchive(rec.id)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05] opacity-50 hover:opacity-80" style={{ color: 'var(--intel-text)' }}>Archive</button>
          )}
        </div>
      </div>
    </div>
  );
}
