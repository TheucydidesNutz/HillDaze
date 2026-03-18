import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import OnePagerList from '@/components/intel/OnePagerList';

export default async function OnePagersPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>One-Pagers</h1>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>
        Single-page advocacy briefs designed to leave behind after legislative meetings, hand out at conferences, or email to stakeholders. Each one-pager distills a specific issue into a headline, your position, key supporting points, and a clear ask — formatted to print on one page with your branding.
      </p>
      <OnePagerList orgId={org.id} isAdmin={isAdmin} />
    </div>
  );
}
