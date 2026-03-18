import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import TrendList from '@/components/intel/TrendList';

export default async function TrendsPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Trend Analysis</h1>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>Pattern analysis across your monitored news and regulatory sources. The analyst identifies legislative momentum, agency rulemaking trajectories, and political shifts relevant to your focus areas, organized by jurisdiction and policy domain.</p>
      <TrendList orgId={org.id} isAdmin={isAdmin} />
    </div>
  );
}
