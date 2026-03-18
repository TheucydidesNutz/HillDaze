'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import DocumentList from '@/components/intel/DocumentList';
import type { IntelMemberRole } from '@/lib/intel/types';

export default function DocumentsPage() {
  const params = useParams();
  const orgSlug = params['org-slug'] as string;
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<IntelMemberRole>('viewer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/intel/orgs');
      if (!res.ok) return;
      const memberships = await res.json();
      const membership = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
      if (membership) {
        setOrgId(membership.org.id);
        setUserRole(membership.role as IntelMemberRole);
      }
      setLoading(false);
    }
    init();
  }, [orgSlug]);

  if (loading || !orgId) {
    return (
      <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--intel-text)' }}>Documents</h1>

      <DocumentList orgId={orgId} userRole={userRole} />
    </div>
  );
}
