'use client';

import { useState, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

export default function ResearchSummaryView({
  targetId,
  onRefresh,
  refreshing,
}: {
  targetId: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intel/research-targets/${targetId}/summary`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.content) setSummary(data);
      }
      setLoading(false);
    }
    load();
  }, [targetId, refreshing]);

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading summary...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--intel-text)' }}>Living Summary</h2>
          {summary && (
            <span className="text-[10px] opacity-40" style={{ color: 'var(--intel-text)' }}>
              v{summary.version} — {new Date(summary.generated_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="text-right">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-40"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            {refreshing ? 'Generating...' : 'Refresh Summary'}
          </button>
          <p className="text-xs italic opacity-40 mt-1" style={{ color: 'var(--intel-text)' }}>Regenerates the living brief from all linked documents, matched news, and previous analysis. Builds on the prior version.</p>
        </div>
      </div>

      {summary ? (
        <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
          <MarkdownRenderer content={summary.content} />
        </div>
      ) : (
        <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02] text-center text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          No summary generated yet. Click &ldquo;Refresh Summary&rdquo; to create the first brief.
        </div>
      )}
    </div>
  );
}
