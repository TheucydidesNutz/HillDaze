import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import RecommendationList from '@/components/intel/RecommendationList';

export default async function RecommendationsPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Article Recommendations</h1>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>AI-generated article pitches based on your priorities, recent developments, and uploaded research. The analyst identifies timely opportunities for op-eds, white papers, and thought leadership. Expand any pitch into a full first draft.</p>
      <RecommendationList orgId={org.id} isAdmin={isAdmin} />
    </div>
  );
}
