'use client';

import { useState } from 'react';

interface ResearchConfig {
  id: string;
  source_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  check_interval: string;
  last_checked_at: string | null;
}

interface ResearchItem {
  id: string;
  title: string;
  content: string | null;
  source_url: string | null;
  source_type: string | null;
  relevance_score: number | null;
  verification_status: string;
  created_at: string;
}

interface Props {
  workspaceSlug: string;
  orgId: string;
  configs: ResearchConfig[];
  items: ResearchItem[];
}

export default function ResearchView({ workspaceSlug, orgId, configs, items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<string>('all');

  async function markItem(itemId: string, status: 'relevant' | 'ignored') {
    const res = await fetch(`/api/workspaces/${workspaceSlug}/research/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, verification_status: status }),
    });
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, verification_status: status } : i));
    }
  }

  async function promoteItem(itemId: string) {
    await fetch(`/api/workspaces/${workspaceSlug}/research/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, verification_status: 'relevant', promote_to_document: true }),
    });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, verification_status: 'relevant' } : i));
  }

  const filteredItems = filter === 'all' ? items : items.filter(i => i.verification_status === filter);

  return (
    <div>
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--analysis-text)' }}>Research</h1>

      {/* Configs */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-2 opacity-60" style={{ color: 'var(--analysis-text)' }}>
          Active Sources ({configs.filter(c => c.enabled).length})
        </h2>
        {configs.length === 0 ? (
          <p className="text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
            No research sources configured. Configure via API.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {configs.map((c) => (
              <div
                key={c.id}
                className={`px-3 py-1.5 rounded-lg text-xs border ${c.enabled ? 'border-white/20' : 'border-white/5 opacity-40'}`}
                style={{ color: 'var(--analysis-text)' }}
              >
                {c.source_type} ({c.check_interval})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['all', 'unreviewed', 'relevant', 'ignored'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              filter === f ? 'bg-white/10' : 'hover:bg-white/[0.05]'
            }`}
            style={{ color: 'var(--analysis-text)' }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <p className="text-sm opacity-40 py-8 text-center" style={{ color: 'var(--analysis-text)' }}>
          No research items
        </p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div key={item.id} className="p-4 rounded-xl border border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--analysis-text)' }}>
                    {item.title}
                  </h3>
                  {item.content && (
                    <p className="text-xs opacity-50 mt-1 line-clamp-2" style={{ color: 'var(--analysis-text)' }}>
                      {item.content.substring(0, 200)}
                    </p>
                  )}
                  <div className="flex gap-3 mt-2 text-xs opacity-40" style={{ color: 'var(--analysis-text)' }}>
                    {item.source_type && <span>{item.source_type}</span>}
                    {item.relevance_score && <span>{(item.relevance_score * 100).toFixed(0)}% relevant</span>}
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {item.verification_status === 'unreviewed' && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => promoteItem(item.id)}
                      className="px-2 py-1 rounded text-xs font-medium text-white hover:opacity-90"
                      style={{ backgroundColor: 'var(--analysis-primary)' }}
                    >
                      Promote
                    </button>
                    <button
                      onClick={() => markItem(item.id, 'relevant')}
                      className="px-2 py-1 rounded text-xs border border-white/10 hover:bg-white/[0.05]"
                      style={{ color: 'var(--analysis-text)' }}
                    >
                      Keep
                    </button>
                    <button
                      onClick={() => markItem(item.id, 'ignored')}
                      className="px-2 py-1 rounded text-xs border border-white/10 hover:bg-white/[0.05] opacity-50"
                      style={{ color: 'var(--analysis-text)' }}
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
