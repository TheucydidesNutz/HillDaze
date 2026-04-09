import { redirect } from 'next/navigation';
import { verifyWorkspaceAccess } from '@/lib/analysis/middleware';
import SettingsView from './SettingsView';

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const access = await verifyWorkspaceAccess(orgSlug, slug);
  if (!access) redirect(`/analysis/${orgSlug}/w`);

  const { org, member, workspace } = access;

  return (
    <SettingsView
      orgSlug={org.slug}
      orgId={org.id}
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      workspaceDescription={workspace.description || ''}
      memberRole={member.role}
    />
  );
}
