import { redirect } from 'next/navigation';
import { verifyWorkspaceAccess } from '@/lib/analysis/middleware';
import { supabaseAdmin } from '@/lib/supabase';
import ResearchView from './ResearchView';

export default async function WorkspaceResearchPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const access = await verifyWorkspaceAccess(orgSlug, slug);
  if (!access) redirect(`/analysis/${orgSlug}/w`);

  const { org, workspace } = access;

  const { data: configs } = await supabaseAdmin
    .from('workspace_research_config')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  const { data: items } = await supabaseAdmin
    .from('workspace_research_items')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <ResearchView
      workspaceSlug={workspace.slug}
      orgId={org.id}
      configs={configs || []}
      items={items || []}
    />
  );
}
