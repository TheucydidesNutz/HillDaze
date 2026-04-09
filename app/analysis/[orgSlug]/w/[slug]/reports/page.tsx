import { redirect } from 'next/navigation';
import { verifyWorkspaceAccess } from '@/lib/analysis/middleware';
import { supabaseAdmin } from '@/lib/supabase';
import ReportsView from './ReportsView';

export default async function WorkspaceReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const access = await verifyWorkspaceAccess(orgSlug, slug);
  if (!access) redirect(`/analysis/${orgSlug}/w`);

  const { org, workspace } = access;

  const { data: templates } = await supabaseAdmin
    .from('workspace_report_templates')
    .select('id, name, description, output_format, last_generated_at, created_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  const { data: reports } = await supabaseAdmin
    .from('workspace_generated_reports')
    .select('id, template_id, title, created_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <ReportsView
      workspaceSlug={workspace.slug}
      orgId={org.id}
      templates={templates || []}
      reports={reports || []}
    />
  );
}
