import { redirect } from 'next/navigation';
import { verifyWorkspaceAccess } from '@/lib/analysis/middleware';
import { getAnalysisBrandingStyles } from '@/lib/analysis/branding';
import WorkspaceLayout from '@/components/analysis/workspace/WorkspaceLayout';

export default async function WorkspaceSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const access = await verifyWorkspaceAccess(orgSlug, slug);

  if (!access) {
    redirect(`/analysis/${orgSlug}/w`);
  }

  const { org, member, workspace } = access;
  const brandingStyles = getAnalysisBrandingStyles(org.branding);

  return (
    <div style={brandingStyles} className="min-h-screen">
      <WorkspaceLayout
        orgSlug={org.slug}
        orgName={org.name}
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        memberDisplayName={member.display_name}
      >
        {children}
      </WorkspaceLayout>
    </div>
  );
}
