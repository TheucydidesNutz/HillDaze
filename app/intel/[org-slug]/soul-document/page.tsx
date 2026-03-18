'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import SoulDocEditor from '@/components/intel/SoulDocEditor';
import SoulDocHistory from '@/components/intel/SoulDocHistory';
import SoulHealthCheckPanel from '@/components/intel/SoulHealthCheckPanel';
import ProposalQueue from '@/components/intel/ProposalQueue';
import type { IntelMemberRole, IntelSoulDocument } from '@/lib/intel/types';

interface PageData {
  doc: IntelSoulDocument | null;
  versions: { id: string; version: number; updated_at: string; updated_by_name: string }[];
  userRole: IntelMemberRole;
  orgId: string;
}

export default function SoulDocumentPage() {
  const params = useParams();
  const orgSlug = params['org-slug'] as string;
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    // Fetch org info to get orgId and user role
    const orgsRes = await fetch('/api/intel/orgs');
    if (!orgsRes.ok) return;
    const memberships = await orgsRes.json();
    const membership = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
    if (!membership) return;

    const orgId = membership.org.id;
    const userRole = membership.role as IntelMemberRole;

    // Fetch soul document and history in parallel
    const [docRes, historyRes] = await Promise.all([
      fetch(`/api/intel/soul-document?orgId=${orgId}`),
      fetch(`/api/intel/soul-document/history?orgId=${orgId}`),
    ]);

    const doc = docRes.ok ? await docRes.json() : null;
    const versions = historyRes.ok ? await historyRes.json() : [];

    setData({ doc, versions, userRole, orgId });
    setLoading(false);
  }, [orgSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
        Loading soul document...
      </div>
    );
  }

  const canEdit = data.userRole === 'super_admin' || data.userRole === 'admin';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--intel-text)' }}>
          Soul Document
        </h1>
        {!canEdit && (
          <span className="text-xs px-3 py-1 rounded-full bg-white/[0.06] border border-white/10" style={{ color: 'var(--intel-text)' }}>
            Read-only
          </span>
        )}
      </div>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>Your organization&apos;s living constitution. This defines your mission, policy priorities, tone of voice, and strategic objectives. The Intelligence Analyst references this in every interaction to stay aligned with your goals. Edit freely — every change is versioned and reversible.</p>

      <SoulDocEditor
        orgId={data.orgId}
        initialContent={data.doc?.content || ''}
        initialVersion={data.doc?.version || 0}
        userRole={data.userRole}
      />

      {canEdit && (
        <SoulDocHistory
          orgId={data.orgId}
          versions={data.versions}
          onRestore={async (content) => {
            await fetch('/api/intel/soul-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ org_id: data.orgId, content }),
            });
            fetchData();
          }}
        />
      )}

      <SoulHealthCheckPanel orgId={data.orgId} isAdmin={canEdit} />

      {canEdit && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--intel-text)' }}>Proposed Amendments</h2>
          <ProposalQueue orgId={data.orgId} isAdmin={canEdit} />
        </div>
      )}
    </div>
  );
}
