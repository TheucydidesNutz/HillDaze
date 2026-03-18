'use client';

import { useState, useEffect, useCallback } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function BriefingDashboard({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [briefing, setBriefing] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [alerts, setAlerts] = useState<{ calendar: any[]; proposals: any[]; strategic: any[]; research: any[] }>({ calendar: [], proposals: [], strategic: [], research: [] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recentRecs, setRecentRecs] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [calRes, proposalRes, strategicRes, recsRes, docsRes] = await Promise.all([
      fetch(`/api/intel/calendar?orgId=${orgId}&start=${now.toISOString().split('T')[0]}&end=${twoWeeks}`, { cache: 'no-store' }),
      fetch(`/api/intel/focus-proposals?orgId=${orgId}&status=pending`, { cache: 'no-store' }),
      fetch(`/api/intel/agent/strategic-review?orgId=${orgId}`, { cache: 'no-store' }),
      fetch(`/api/intel/agent/generate-recommendations?orgId=${orgId}`, { cache: 'no-store' }),
      fetch(`/api/intel/documents?orgId=${orgId}`, { cache: 'no-store' }),
    ]);

    setAlerts({
      calendar: calRes.ok ? await calRes.json() : [],
      proposals: proposalRes.ok ? await proposalRes.json() : [],
      strategic: (strategicRes.ok ? await strategicRes.json() : []).filter((r: { priority: string; status: string }) => r.priority === 'high' && r.status === 'new'),
      research: [],
    });

    setRecentRecs((recsRes.ok ? await recsRes.json() : []).slice(0, 5));
    setRecentDocs((docsRes.ok ? await docsRes.json() : []).slice(0, 5));
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function refreshBriefing() {
    setGenerating(true);
    const res = await fetch('/api/intel/agent/generate-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) setBriefing(await res.json());
    setGenerating(false);
  }

  const totalAlerts = alerts.calendar.length + alerts.proposals.length + alerts.strategic.length;

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading briefing...</div>;

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--intel-text)' }}>Executive Summary</h2>
          {isAdmin && (
            <div className="text-right">
              <button onClick={refreshBriefing} disabled={generating} className="px-4 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--intel-primary)' }}>
                {generating ? 'Generating...' : 'Refresh Briefing'}
              </button>
              <p className="text-xs italic opacity-40 mt-1" style={{ color: 'var(--intel-text)' }}>Regenerates the weekly intelligence brief from all recent activity across the platform.</p>
            </div>
          )}
        </div>
        {briefing?.executive_summary ? (
          <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
            <MarkdownRenderer content={briefing.executive_summary} />
          </div>
        ) : (
          <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02] text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
            Click &ldquo;Refresh Briefing&rdquo; to generate an executive summary.
          </div>
        )}
      </section>

      {/* Priority Alerts */}
      {totalAlerts > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--intel-text)' }}>Priority Alerts ({totalAlerts})</h2>
          <div className="space-y-2">
            {alerts.calendar.map((e: { id: string; title: string; event_date: string; event_type: string }) => (
              <div key={e.id} className="px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center gap-3">
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300">Deadline</span>
                <span className="text-sm" style={{ color: 'var(--intel-text)' }}>{e.title} — {e.event_date}</span>
              </div>
            ))}
            {alerts.proposals.map((p: { id: string; description: string }) => (
              <div key={p.id} className="px-4 py-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-3">
                <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">Approval</span>
                <span className="text-sm" style={{ color: 'var(--intel-text)' }}>{p.description}</span>
              </div>
            ))}
            {alerts.strategic.map((r: { id: string; title: string }) => (
              <div key={r.id} className="px-4 py-3 rounded-lg border border-orange-500/20 bg-orange-500/5 flex items-center gap-3">
                <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">Strategic</span>
                <span className="text-sm" style={{ color: 'var(--intel-text)' }}>{r.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Recommendations */}
      {recentRecs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--intel-text)' }}>Recent Recommendations</h2>
          <div className="space-y-2">
            {recentRecs.map((r: { id: string; title: string; status: string; article_type: string }) => (
              <div key={r.id} className="px-4 py-3 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--intel-text)' }}>{r.title}</span>
                <div className="flex gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>{r.article_type}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Documents */}
      {recentDocs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--intel-text)' }}>Recent Documents</h2>
          <div className="space-y-2">
            {recentDocs.map((d: { id: string; filename: string; summary_metadata: { title?: string } | null; uploaded_at: string }) => (
              <div key={d.id} className="px-4 py-3 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--intel-text)' }}>{d.summary_metadata?.title || d.filename}</span>
                <span className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>{new Date(d.uploaded_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
