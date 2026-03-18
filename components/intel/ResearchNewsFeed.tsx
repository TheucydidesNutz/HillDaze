'use client';

import { useState, useEffect } from 'react';

export default function ResearchNewsFeed({ targetId }: { targetId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intel/research-targets/${targetId}/news?limit=20&offset=${offset}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (offset === 0) setItems(data);
        else setItems(prev => [...prev, ...data]);
        setHasMore(data.length === 20);
      }
      setLoading(false);
    }
    load();
  }, [targetId, offset]);

  if (loading && items.length === 0) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading news...</div>;

  return (
    <div>
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--intel-text)' }}>Matched News</h2>
      {items.length === 0 ? (
        <div className="p-6 text-center text-sm opacity-40 rounded-xl border border-white/10" style={{ color: 'var(--intel-text)' }}>
          No matched news items yet. Items will appear after feed ingestion runs.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <div key={n.id} className="px-4 py-3 rounded-lg border border-white/5 hover:bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>{n.source_type}</span>
                {n.relevance_score != null && (
                  <span className="text-[10px] opacity-40" style={{ color: 'var(--intel-text)' }}>{(n.relevance_score * 100).toFixed(0)}%</span>
                )}
                <span className="text-[10px] opacity-30 ml-auto" style={{ color: 'var(--intel-text)' }}>{new Date(n.ingested_at).toLocaleDateString()}</span>
              </div>
              <h4 className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>{n.title}</h4>
              {(n.summary || n.raw_content) && (
                <p className="text-xs opacity-50 mt-1 line-clamp-2" style={{ color: 'var(--intel-text)' }}>{(n.summary || n.raw_content || '').substring(0, 200)}</p>
              )}
            </div>
          ))}
          {hasMore && (
            <button onClick={() => setOffset(prev => prev + 20)} className="w-full py-2 text-xs opacity-40 hover:opacity-70" style={{ color: 'var(--intel-text)' }}>Load more</button>
          )}
        </div>
      )}
    </div>
  );
}
