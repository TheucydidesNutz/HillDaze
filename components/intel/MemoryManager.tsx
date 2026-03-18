'use client';

import { useState, useEffect, useCallback } from 'react';

const TYPE_COLORS: Record<string, string> = {
  observation: 'bg-blue-500/20 text-blue-300',
  decision: 'bg-green-500/20 text-green-300',
  preference: 'bg-purple-500/20 text-purple-300',
  recurring_topic: 'bg-orange-500/20 text-orange-300',
  strategic_insight: 'bg-cyan-500/20 text-cyan-300',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function MemoryManager({ orgId }: { orgId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sort, setSort] = useState('last_seen_at');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchMemories = useCallback(async () => {
    const params = new URLSearchParams({ orgId, status: statusFilter, sort });
    if (typeFilter) params.set('type', typeFilter);
    const res = await fetch(`/api/intel/memory?${params}`, { cache: 'no-store' });
    if (res.ok) setMemories(await res.json());
    setLoading(false);
  }, [orgId, statusFilter, sort, typeFilter]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  async function archiveMemory(id: string) {
    await fetch('/api/intel/memory', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memory_id: id, status: 'archived', org_id: orgId }) });
    fetchMemories();
  }

  async function restoreMemory(id: string) {
    await fetch('/api/intel/memory', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memory_id: id, status: 'active', org_id: orgId }) });
    fetchMemories();
  }

  async function saveEdit(id: string) {
    await fetch('/api/intel/memory', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memory_id: id, content: editContent, org_id: orgId }) });
    setEditingId(null);
    fetchMemories();
  }

  async function deleteMemory(id: string) {
    await fetch('/api/intel/memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memory_id: id, org_id: orgId }) });
    fetchMemories();
  }

  const filtered = memories.filter(m => !search || m.subject?.toLowerCase().includes(search.toLowerCase()) || m.content?.toLowerCase().includes(search.toLowerCase()));

  const typeCounts: Record<string, number> = {};
  memories.forEach(m => { typeCounts[m.memory_type] = (typeCounts[m.memory_type] || 0) + 1; });

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        <div className="px-3 py-2 rounded-lg bg-white/[0.04] text-sm" style={{ color: 'var(--intel-text)' }}>
          <span className="opacity-40">Total: </span>{memories.length}
        </div>
        {Object.entries(typeCounts).map(([type, count]) => (
          <div key={type} className="px-3 py-2 rounded-lg bg-white/[0.04] text-sm" style={{ color: 'var(--intel-text)' }}>
            <span className="opacity-40">{type}: </span>{count}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white w-48" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
          <option value="" className="bg-gray-900">All types</option>
          {['observation', 'decision', 'preference', 'recurring_topic', 'strategic_insight'].map(t => <option key={t} value={t} className="bg-gray-900">{t.replace('_', ' ')}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
          <option value="active" className="bg-gray-900">Active</option>
          <option value="archived" className="bg-gray-900">Archived</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
          <option value="last_seen_at" className="bg-gray-900">Last seen</option>
          <option value="mention_count" className="bg-gray-900">Mentions</option>
          <option value="confidence" className="bg-gray-900">Confidence</option>
        </select>
      </div>

      {/* Memory list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>No memories found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div key={m.id} className="px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_COLORS[m.memory_type] || 'bg-white/10'}`}>{m.memory_type?.replace('_', ' ')}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>{m.subject}</span>
                  </div>
                  {editingId === m.id ? (
                    <div className="flex gap-2 mt-1">
                      <input value={editContent} onChange={e => setEditContent(e.target.value)} className="flex-1 px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-white" />
                      <button onClick={() => saveEdit(m.id)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--intel-primary)' }}>Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 opacity-40" style={{ color: 'var(--intel-text)' }}>Cancel</button>
                    </div>
                  ) : (
                    <p className="text-xs opacity-60" style={{ color: 'var(--intel-text)' }}>{m.content}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-10 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${m.confidence * 100}%`, backgroundColor: 'var(--intel-primary)' }} />
                      </div>
                      <span className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>{(m.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <span className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>{m.mention_count}x</span>
                    <span className="text-[10px] opacity-20" style={{ color: 'var(--intel-text)' }}>Last: {m.last_seen_at ? new Date(m.last_seen_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {editingId !== m.id && (
                    <button onClick={() => { setEditingId(m.id); setEditContent(m.content); }} className="text-[10px] px-2 py-1 rounded hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>Edit</button>
                  )}
                  {m.status === 'active' ? (
                    <button onClick={() => archiveMemory(m.id)} className="text-[10px] px-2 py-1 rounded text-yellow-400/60 hover:text-yellow-400">Archive</button>
                  ) : (
                    <button onClick={() => restoreMemory(m.id)} className="text-[10px] px-2 py-1 rounded text-green-400/60 hover:text-green-400">Restore</button>
                  )}
                  <button onClick={() => deleteMemory(m.id)} className="text-[10px] px-2 py-1 rounded text-red-400/40 hover:text-red-400">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
