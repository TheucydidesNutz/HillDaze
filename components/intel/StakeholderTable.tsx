'use client';

import { useState, useEffect, useCallback } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StakeholderTable({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stakeholders, setStakeholders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', title: '', organization: '', role_type: 'other', stance: '', notes: '' });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('mention_count');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing, setEditing] = useState<any>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/intel/stakeholders?orgId=${orgId}&sort=${sort}`, { cache: 'no-store' });
    if (res.ok) setStakeholders(await res.json());
    setLoading(false);
  }, [orgId, sort]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function addStakeholder(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/intel/stakeholders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, ...addForm }),
    });
    if (res.ok) { setShowAdd(false); setAddForm({ name: '', title: '', organization: '', role_type: 'other', stance: '', notes: '' }); fetchData(); }
  }

  async function updateStakeholder(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/intel/stakeholders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    fetchData();
    setEditing(null);
  }

  async function deleteStakeholder(id: string) {
    await fetch(`/api/intel/stakeholders/${id}`, { method: 'DELETE' });
    fetchData();
  }

  const filtered = stakeholders.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.organization?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex gap-3 items-center">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
            <option value="mention_count" className="bg-gray-900">Mentions</option>
            <option value="influence_score" className="bg-gray-900">Influence</option>
            <option value="last_mentioned_at" className="bg-gray-900">Recent</option>
          </select>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Add Stakeholder</button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={addStakeholder} className="mb-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] grid grid-cols-1 md:grid-cols-3 gap-3">
          <input required placeholder="Name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
          <input placeholder="Title" value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
          <input placeholder="Organization" value={addForm.organization} onChange={e => setAddForm({ ...addForm, organization: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
          <select value={addForm.role_type} onChange={e => setAddForm({ ...addForm, role_type: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
            {['regulator', 'legislator', 'lobbyist', 'industry_leader', 'advocate', 'media', 'academic', 'policy_actor', 'other'].map(r => <option key={r} value={r} className="bg-gray-900">{r.replace('_', ' ')}</option>)}
          </select>
          <input placeholder="Stance" value={addForm.stance} onChange={e => setAddForm({ ...addForm, stance: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
          <button type="submit" className="px-3 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Add</button>
        </form>
      )}

      <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr className="border-b border-white/10 bg-white/[0.02]">
            {['Name', 'Title', 'Organization', 'Role', 'Influence', 'Mentions', 'Stance', ''].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-medium uppercase opacity-40" style={{ color: 'var(--intel-text)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>No stakeholders found</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--intel-text)' }}>{s.name}</td>
                <td className="px-4 py-2.5 text-xs opacity-60" style={{ color: 'var(--intel-text)' }}>{s.title || '\u2014'}</td>
                <td className="px-4 py-2.5 text-xs opacity-60" style={{ color: 'var(--intel-text)' }}>{s.organization || '\u2014'}</td>
                <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>{s.role_type?.replace('_', ' ')}</span></td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(s.influence_score || 0) * 100}%`, backgroundColor: 'var(--intel-primary)' }} />
                    </div>
                    <span className="text-[10px] opacity-40" style={{ color: 'var(--intel-text)' }}>{s.influence_score != null ? (s.influence_score * 1).toFixed(1) : '\u2014'}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs opacity-60" style={{ color: 'var(--intel-text)' }}>{s.mention_count || 0}</td>
                <td className="px-4 py-2.5">
                  {editing === s.id ? (
                    <input autoFocus defaultValue={s.stance || ''} onBlur={e => updateStakeholder(s.id, { stance: e.target.value })} onKeyDown={e => e.key === 'Enter' && updateStakeholder(s.id, { stance: (e.target as HTMLInputElement).value })} className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-white w-24" />
                  ) : (
                    <button onClick={() => isAdmin && setEditing(s.id)} className="text-xs opacity-60 hover:opacity-80" style={{ color: 'var(--intel-text)' }}>{s.stance || 'Set...'}</button>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {isAdmin && <button onClick={() => deleteStakeholder(s.id)} className="text-xs text-red-400/50 hover:text-red-400">Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
