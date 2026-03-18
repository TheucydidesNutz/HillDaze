import { verifyOrgAccess } from '@/lib/intel/middleware';
import { redirect } from 'next/navigation';
import FeedManager from '@/components/intel/FeedManager';

export default async function FeedsPage({
  params,
}: {
  params: Promise<{ 'org-slug': string }>;
}) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;

  if (member.role !== 'super_admin' && member.role !== 'admin') {
    redirect(`/intel/${orgSlug}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Feed Sources</h1>
      <p className="text-sm italic opacity-60 mb-8" style={{ color: 'var(--intel-text)' }}>RSS feeds and competitive sources that the Intelligence Analyst monitors in the background. Items are scored for relevance to your priorities, and notable developments surface in chat, briefings, and recommendations. Add industry publications, government feeds, and allied or competing organizations.</p>
      <FeedManager orgId={org.id} />
    </div>
  );
}
