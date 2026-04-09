import { redirect } from 'next/navigation';
import { verifyWorkspaceAccess } from '@/lib/analysis/middleware';
import SoulDocView from './SoulDocView';

export default async function WorkspaceSoulDocPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const access = await verifyWorkspaceAccess(orgSlug, slug);
  if (!access) redirect(`/analysis/${orgSlug}/w`);

  const { org, workspace } = access;

  return (
    <SoulDocView
      workspaceSlug={workspace.slug}
      orgId={org.id}
      soulDocMd={workspace.soul_doc_md || ''}
      version={workspace.soul_doc_version}
    />
  );
}
