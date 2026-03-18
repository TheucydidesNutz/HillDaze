'use client';

import { useState, useEffect } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SoulHealthCheckPanel({ orgId, isAdmin, onCreateProposal }: { orgId: string; isAdmin: boolean; onCreateProposal?: (desc: string, rationale: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [check, setCheck] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intel/soul-health-check?orgId=${orgId}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) setCheck(data);
      }
      setLoading(false);
    }
    load();
  }, [orgId, generating]);

  async function runCheck() {
    setGenerating(true);
    const res = await fetch('/api/intel/soul-health-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) setCheck(await res.json());
    setGenerating(false);
  }

  function scoreColor(score: number): string {
    if (score >= 0.7) return 'text-green-400';
    if (score >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  }

  function scoreBg(score: number): string {
    if (score >= 0.7) return 'bg-green-500';
    if (score >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  if (loading) return null;

  return (
    <div className="mt-6 border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium hover:bg-white/[0.03] transition-colors"
        style={{ color: 'var(--intel-text)' }}
      >
        <div className="flex items-center gap-3">
          <span>Soul Document Health Check</span>
          {check && (
            <span className={`text-xs font-bold ${scoreColor(check.overall_health_score)}`}>
              {(check.overall_health_score * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/10 pt-4 space-y-4">
          {isAdmin && (
            <div>
              <button onClick={runCheck} disabled={generating} className="px-4 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--intel-primary)' }}>
                {generating ? 'Running...' : check ? 'Re-run Health Check' : 'Run Health Check'}
              </button>
              <p className="text-xs italic opacity-40 mt-1" style={{ color: 'var(--intel-text)' }}>Compares your stated priorities against actual activity to identify drift, dormant topics, and unstated focus areas.</p>
            </div>
          )}

          {check ? (
            <>
              {/* Score gauge */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${scoreBg(check.overall_health_score)}`} style={{ width: `${check.overall_health_score * 100}%` }} />
                </div>
                <span className={`text-sm font-bold ${scoreColor(check.overall_health_score)}`}>{(check.overall_health_score * 100).toFixed(0)}%</span>
              </div>

              <p className="text-xs opacity-30" style={{ color: 'var(--intel-text)' }}>Last checked: {new Date(check.generated_at).toLocaleDateString()}</p>

              {check.narrative && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Assessment</h4>
                  <p className="text-xs opacity-70 whitespace-pre-wrap" style={{ color: 'var(--intel-text)' }}>{check.narrative}</p>
                </div>
              )}

              {check.dormant_topics?.length > 0 && (
                <FindingSection title="Dormant Topics" items={check.dormant_topics} type="dormant" onCreateProposal={onCreateProposal} />
              )}
              {check.unstated_topics?.length > 0 && (
                <FindingSection title="Unstated Topics (High Activity)" items={check.unstated_topics} type="unstated" onCreateProposal={onCreateProposal} />
              )}
              {check.priority_mismatches?.length > 0 && (
                <FindingSection title="Priority Mismatches" items={check.priority_mismatches} type="mismatch" onCreateProposal={onCreateProposal} />
              )}
              {check.objective_progress?.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-2" style={{ color: 'var(--intel-text)' }}>Objective Progress</h4>
                  {check.objective_progress.map((o: { objective: string; progress: string; assessment: string }, i: number) => (
                    <div key={i} className="mb-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.progress === 'on_track' ? 'bg-green-500/20 text-green-300' : o.progress === 'behind' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>{o.progress?.replace('_', ' ')}</span>
                        <span className="text-xs" style={{ color: 'var(--intel-text)' }}>{o.objective}</span>
                      </div>
                      <p className="text-[10px] opacity-50 mt-1" style={{ color: 'var(--intel-text)' }}>{o.assessment}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>No health check has been run yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FindingSection({ title, items, type, onCreateProposal }: {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  type: string;
  onCreateProposal?: (desc: string, rationale: string) => void;
}) {
  const proposalType = type === 'dormant' ? 'remove_topic' : type === 'unstated' ? 'add_topic' : 'reprioritize';

  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-2" style={{ color: 'var(--intel-text)' }}>{title}</h4>
      {items.map((item: { topic: string; explanation: string; stated_priority?: number; actual_engagement?: string }, i: number) => (
        <div key={i} className="mb-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-medium" style={{ color: 'var(--intel-text)' }}>{item.topic}</span>
            <p className="text-[10px] opacity-50 mt-0.5" style={{ color: 'var(--intel-text)' }}>{item.explanation}</p>
          </div>
          {onCreateProposal && (
            <button
              onClick={() => onCreateProposal(
                `${proposalType === 'add_topic' ? 'Add' : proposalType === 'remove_topic' ? 'Deprioritize' : 'Reprioritize'}: ${item.topic}`,
                item.explanation
              )}
              className="text-[10px] shrink-0 px-2 py-1 rounded border border-white/10 hover:bg-white/[0.05]"
              style={{ color: 'var(--intel-primary)' }}
            >
              Create Proposal
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
