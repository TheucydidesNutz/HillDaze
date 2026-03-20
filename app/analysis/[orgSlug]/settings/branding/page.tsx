import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import { redirect } from 'next/navigation';
import AnalysisBrandingEditor from './AnalysisBrandingEditor';

export default async function AnalysisBrandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await verifyAnalysisAccess(orgSlug);
  if (!access) redirect('/analysis/login');

  const { org, member } = access;

  if (member.role !== 'super_admin' && member.role !== 'admin') {
    redirect(`/analysis/${orgSlug}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--analysis-text)] mb-2">Branding</h1>
      <p
        className="text-sm italic opacity-60 mb-8"
        style={{ color: 'var(--analysis-text)' }}
      >
        Customize your Analysis portal&apos;s appearance. Colors apply across all pages
        and are reflected in generated reports and profile views.
      </p>
      <AnalysisBrandingEditor orgId={org.id} branding={org.branding} />
    </div>
  );
}
