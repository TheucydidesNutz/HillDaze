import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import ReportList from '@/components/intel/ReportList';

export default async function ReportsPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Reports</h1>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>Generated deliverables compiling your organization&apos;s intelligence activity into downloadable Word documents. Monthly summaries, quarterly reviews, executive briefings, and legislative scorecards — formatted with your branding and ready for client distribution.</p>
      <ReportList orgId={org.id} isAdmin={isAdmin} />
    </div>
  );
}
