import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import FocusAreaList from '@/components/intel/FocusAreaList';
import ProposalQueue from '@/components/intel/ProposalQueue';

export default async function FocusPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--intel-text)' }}>Focus Areas</h1>
      <p className="text-sm italic opacity-60" style={{ color: 'var(--intel-text)' }}>Your current policy priorities, extracted from the Soul Document. The Intelligence Analyst proposes additions, removals, and re-prioritizations based on legislative activity and engagement patterns. Approve or reject each proposal — nothing changes automatically.</p>
      <FocusAreaList orgId={org.id} />
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--intel-text)' }}>Proposal Queue</h2>
        <ProposalQueue orgId={org.id} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
