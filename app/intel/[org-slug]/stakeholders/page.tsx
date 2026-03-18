import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import StakeholderTable from '@/components/intel/StakeholderTable';

export default async function StakeholdersPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Stakeholders</h1>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>Key individuals identified across your news feeds and regulatory monitoring — legislators, regulators, agency officials, industry leaders, and advocates. Influence scores and stance assessments are maintained by the analyst. Add notes to track your own engagement history.</p>
      <StakeholderTable orgId={org.id} isAdmin={isAdmin} />
    </div>
  );
}
