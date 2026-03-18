import { verifyOrgAccess } from '@/lib/intel/middleware';
import { redirect } from 'next/navigation';
import ApiSourceManager from '@/components/intel/ApiSourceManager';

export default async function ApisPage({
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
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Government API Sources</h1>
      <p className="text-sm italic opacity-60 mb-8" style={{ color: 'var(--intel-text)' }}>Government data sources providing real-time legislative and regulatory intelligence. The Federal Register, Congress.gov, and Regulations.gov APIs are queried automatically using your configured search terms. No API key is needed for the Federal Register; Congress.gov and Regulations.gov require free API keys.</p>
      <ApiSourceManager orgId={org.id} />
    </div>
  );
}
