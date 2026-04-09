import { redirect } from 'next/navigation';
import { verifyWorkspaceAccess } from '@/lib/analysis/middleware';
import WorkspaceChatInterface from '@/components/analysis/workspace/WorkspaceChatInterface';

export default async function WorkspaceChatPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const access = await verifyWorkspaceAccess(orgSlug, slug);
  if (!access) redirect(`/analysis/${orgSlug}/w`);

  const { org, workspace } = access;

  return (
    <WorkspaceChatInterface
      workspaceSlug={workspace.slug}
      orgId={org.id}
      orgName={org.name}
    />
  );
}
