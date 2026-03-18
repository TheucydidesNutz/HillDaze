import { verifyOrgAccess } from '@/lib/intel/middleware';
import { redirect } from 'next/navigation';
import BrandingEditor from '@/components/intel/BrandingEditor';

export default async function BrandingPage({
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
      <h1 className="text-2xl font-bold text-[var(--intel-text)] mb-2">Branding</h1>
      <p className="text-sm italic opacity-60 mb-8" style={{ color: 'var(--intel-text)' }}>Customize your portal&apos;s appearance. Colors apply across all pages and are used in generated report documents. Upload your organization&apos;s logo to appear in the header and on deliverables.</p>
      <BrandingEditor orgId={org.id} branding={org.branding} />
    </div>
  );
}
