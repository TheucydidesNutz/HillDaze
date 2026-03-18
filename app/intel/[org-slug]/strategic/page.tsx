import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import StrategicList from '@/components/intel/StrategicList';

export default async function StrategicPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Strategic Recommendations</h1>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>Actionable recommendations to advance your organization&apos;s visibility and influence. Includes coalition opportunities, testimony and comment period deadlines, media engagement strategies, and stakeholder outreach suggestions — all tied to your current priorities and upcoming deadlines.</p>
      <StrategicList orgId={org.id} isAdmin={isAdmin} />
    </div>
  );
}
