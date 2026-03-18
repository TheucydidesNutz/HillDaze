'use client';

import { useState } from 'react';

interface FormData {
  name: string;
  description: string;
  tracking_brief: string;
  search_terms: string;
  status: string;
}

export default function ResearchTargetForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<FormData & { search_terms: string[] }>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>({
    name: initial?.name || '',
    description: initial?.description || '',
    tracking_brief: initial?.tracking_brief || '',
    search_terms: Array.isArray(initial?.search_terms) ? initial.search_terms.join(', ') : initial?.search_terms || '',
    status: initial?.status || 'active',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>Name *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Multispectral Drone Technology" />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>Description *</label>
        <input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1-2 sentence description" />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>Tracking Brief</label>
        <textarea value={form.tracking_brief} onChange={e => setForm({ ...form, tracking_brief: e.target.value })} rows={3} className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Detailed instructions for what to watch for..." />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>Search Terms * (comma separated)</label>
        <input required value={form.search_terms} onChange={e => setForm({ ...form, search_terms: e.target.value })} className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="multispectral, hyperspectral, NDVI, crop imaging" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Save</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>Cancel</button>
      </div>
    </form>
  );
}
