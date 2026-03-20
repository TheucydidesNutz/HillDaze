import { redirect } from 'next/navigation';
import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import { getAnalysisBrandingStyles } from '@/lib/analysis/branding';
import AnalysisLayout from '@/components/analysis/AnalysisLayout';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await verifyAnalysisAccess(orgSlug);

  if (!access) {
    redirect('/analysis/login');
  }

  const { org, member, user } = access;
  const brandingStyles = getAnalysisBrandingStyles(org.branding);

  return (
    <div
      style={brandingStyles}
      className="min-h-screen"
    >
      <AnalysisLayout
        org={{ id: org.id, name: org.name, slug: org.slug, branding: org.branding }}
        member={{ role: member.role, display_name: member.display_name }}
        userEmail={user.email || ''}
      >
        {children}
      </AnalysisLayout>
    </div>
  );
}
