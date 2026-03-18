'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ResearchTargetCard from '@/components/intel/ResearchTargetCard';
import ResearchTargetForm from '@/components/intel/ResearchTargetForm';

export default function ResearchPage() {
  const params = useParams();
  const orgSlug = params['org-slug'] as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [targets, setTargets] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(async () => {
    // Get org info
    const orgsRes = await fetch('/api/intel/orgs', { cache: 'no-store' });
    if (!orgsRes.ok) return;
    const memberships = await orgsRes.json();
    const m = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
    if (!m) return;

    setOrgId(m.org.id);
    setIsAdmin(m.role === 'super_admin' || m.role === 'admin');

    const res = await fetch(`/api/intel/research-targets?orgId=${m.org.id}`, { cache: 'no-store' });
    if (res.ok) setTargets(await res.json());
    setLoading(false);
  }, [orgSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreate(form: { name: string; description: string; search_terms: string; tracking_brief: string }) {
    if (!orgId) return;
    const res = await fetch('/api/intel/research-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: orgId,
        name: form.name,
        description: form.description,
        tracking_brief: form.tracking_brief,
        search_terms: form.search_terms.split(',').map(s => s.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      fetchData();
    }
  }

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--intel-text)' }}>Research Targets</h1>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>
            {showForm ? 'Cancel' : 'New Research Target'}
          </button>
        )}
      </div>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>Focused intelligence workspaces for specific sub-topics. Each target has its own document collection, auto-filtered news feed, and a living summary the analyst maintains and updates over time. Create targets for technologies, regulatory pathways, or market trends you want to track in depth.</p>

      {showForm && (
        <div className="mb-6">
          <ResearchTargetForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {targets.length === 0 ? (
        <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          No research targets yet. Create one to start tracking a topic.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targets.map(t => <ResearchTargetCard key={t.id} target={t} orgSlug={orgSlug} />)}
        </div>
      )}
    </div>
  );
}
