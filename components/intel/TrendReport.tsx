'use client';

import { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function TrendReport({ trend }: { trend: any }) {
  const [expanded, setExpanded] = useState(false);

  const typeColors: Record<string, string> = {
    state_legislation: 'bg-purple-500/20 text-purple-300',
    federal_policy: 'bg-blue-500/20 text-blue-300',
    agency_rulemaking: 'bg-orange-500/20 text-orange-300',
    political_momentum: 'bg-green-500/20 text-green-300',
  };

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--intel-text)' }}>{trend.title}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${typeColors[trend.trend_type] || 'bg-white/10 text-white/60'}`}>
            {trend.trend_type?.replace('_', ' ')}
          </span>
        </div>

        <p className="text-xs opacity-70 mb-3" style={{ color: 'var(--intel-text)' }}>{trend.summary}</p>

        {trend.jurisdictions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {trend.jurisdictions.map((j: string) => (
              <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>{j}</span>
            ))}
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)} className="text-xs hover:underline" style={{ color: 'var(--intel-primary)' }}>
          {expanded ? 'Collapse' : 'Read Full Analysis'}
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {trend.detail && <MarkdownRenderer content={trend.detail} />}
            {trend.implications && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Implications</h4>
                <p className="text-xs opacity-70" style={{ color: 'var(--intel-text)' }}>{trend.implications}</p>
              </div>
            )}
            {trend.recommended_response && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Recommended Response</h4>
                <p className="text-xs opacity-70" style={{ color: 'var(--intel-text)' }}>{trend.recommended_response}</p>
              </div>
            )}
            {trend.key_actors?.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Key Actors</h4>
                <div className="space-y-1">{trend.key_actors.map((a: { name: string; role: string; organization: string }, i: number) => (
                  <p key={i} className="text-xs opacity-70" style={{ color: 'var(--intel-text)' }}>{a.name} — {a.role}, {a.organization}</p>
                ))}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
