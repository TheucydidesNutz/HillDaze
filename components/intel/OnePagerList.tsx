'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, FileText, Plus } from 'lucide-react';
import OnePagerEditor from './OnePagerEditor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function OnePagerList({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing, setEditing] = useState<any>(null);

  const [form, setForm] = useState({
    topic: '',
    audience: 'General/Executive',
    specific_ask: '',
    key_data_points: '',
  });

  const AUDIENCES = [
    'Congressional Staff',
    'State Legislators',
    'Regulators/Agency Officials',
    'Industry/Trade Partners',
    'Media',
    'General/Executive',
  ];

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/intel/one-pagers?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setMessage('');

    const res = await fetch('/api/intel/one-pagers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: orgId,
        topic: form.topic,
        audience: form.audience,
        specific_ask: form.specific_ask || undefined,
        key_data_points: form.key_data_points || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setItems(prev => [data, ...prev]);
      setShowForm(false);
      setEditing(data);
      setForm({ topic: '', audience: 'General/Executive', specific_ask: '', key_data_points: '' });
      setMessage('One-pager generated');
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || 'Generation failed');
    }
    setGenerating(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/intel/one-pagers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id));
      if (editing?.id === id) setEditing(null);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSaved(updated: any) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    setEditing(updated);
  }

  if (editing) {
    return (
      <OnePagerEditor
        item={editing}
        orgId={orgId}
        onBack={() => { setEditing(null); fetchItems(); }}
        onSaved={handleSaved}
      />
    );
  }

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div>
      {message && (
        <div className="mb-4 p-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm" style={{ color: 'var(--intel-primary)' }}>
          {message}
        </div>
      )}

      {/* New One-Pager form */}
      {showForm && (
        <form onSubmit={handleGenerate} className="mb-6 p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>
              Topic *
            </label>
            <input
              required
              value={form.topic}
              onChange={e => setForm({ ...form, topic: e.target.value })}
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
              placeholder='e.g., "Premium Cigar Exemption from FDA Deeming Rule"'
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>
              Audience *
            </label>
            <select
              value={form.audience}
              onChange={e => setForm({ ...form, audience: e.target.value })}
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
            >
              {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>
              Specific Ask (optional)
            </label>
            <input
              value={form.specific_ask}
              onChange={e => setForm({ ...form, specific_ask: e.target.value })}
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
              placeholder='e.g., "Co-sponsor the Premium Cigar Equity Act"'
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>
              Key Data Points (optional)
            </label>
            <textarea
              value={form.key_data_points}
              onChange={e => setForm({ ...form, key_data_points: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
              placeholder="Any specific statistics or facts to include..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={generating}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40"
              style={{ backgroundColor: 'var(--intel-primary)' }}
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/[0.05]"
              style={{ color: 'var(--intel-text)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Header with button */}
      {!showForm && (
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
            {items.length} one-pager{items.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            <Plus size={16} />
            New One-Pager
          </button>
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          No one-pagers yet. Click &ldquo;New One-Pager&rdquo; to generate your first advocacy brief.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className="border border-white/10 rounded-xl overflow-hidden hover:border-white/15 transition-colors"
            >
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <button
                    onClick={() => setEditing(item)}
                    className="flex items-center gap-2 text-left group"
                  >
                    <FileText size={16} className="shrink-0 opacity-40" style={{ color: 'var(--intel-primary)' }} />
                    <h3 className="text-sm font-semibold leading-snug group-hover:underline" style={{ color: 'var(--intel-text)' }}>
                      {item.title}
                    </h3>
                  </button>
                  <div className="flex gap-1.5 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06]" style={{ color: 'var(--intel-primary)' }}>
                      {item.audience}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      item.status === 'final'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs opacity-60 mb-3 line-clamp-1" style={{ color: 'var(--intel-text)' }}>
                  {item.topic}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    {item.docx_storage_path && (
                      <a
                        href={`/api/intel/one-pagers/${item.id}/download`}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]"
                        style={{ color: 'var(--intel-text)' }}
                      >
                        <Download size={12} /> .docx
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-red-400/50 hover:text-red-400 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
