import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';

export default async function TemplatesPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { member } = access;
  if (member.role !== 'super_admin' && member.role !== 'admin') {
    redirect(`/intel/${orgSlug}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--intel-text)' }}>Report Templates</h1>
      <div className="p-8 rounded-xl border border-white/10 bg-white/[0.02] text-center">
        <p className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          Template upload for report styling is coming soon. Reports currently use default professional formatting with your organization&apos;s branding colors.
        </p>
      </div>
    </div>
  );
}
