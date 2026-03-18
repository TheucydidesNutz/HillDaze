import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import ReliabilityDashboard from '@/components/intel/ReliabilityDashboard';

export default async function ReliabilityPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  if (member.role !== 'super_admin') {
    redirect(`/intel/${orgSlug}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--intel-text)' }}>Reliability Dashboard</h1>
      <ReliabilityDashboard orgId={org.id} />
    </div>
  );
}
