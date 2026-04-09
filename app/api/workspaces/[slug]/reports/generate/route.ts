import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import { generateWorkspaceReport } from '@/lib/analysis/agent/generate-workspace-report';
import type { WorkspaceReportTemplate } from '@/lib/analysis/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { org_id, template_id, title, additional_context } = body as {
    org_id: string;
    template_id: string;
    title?: string;
    additional_context?: string;
  };

  if (!org_id || !template_id) {
    return NextResponse.json({ error: 'org_id and template_id required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data: template } = await supabaseAdmin
    .from('workspace_report_templates')
    .select('*')
    .eq('id', template_id)
    .eq('workspace_id', workspace.id)
    .single();

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const { content, metadata } = await generateWorkspaceReport(
    workspace,
    template as WorkspaceReportTemplate,
    org_id,
    additional_context,
  );

  const reportTitle = title || `${template.name} - ${new Date().toLocaleDateString()}`;

  const { data: report, error } = await supabaseAdmin
    .from('workspace_generated_reports')
    .insert({
      template_id,
      workspace_id: workspace.id,
      title: reportTitle,
      content,
      metadata,
      generated_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update template's last_generated_at
  await supabaseAdmin
    .from('workspace_report_templates')
    .update({ last_generated_at: new Date().toISOString() })
    .eq('id', template_id);

  return NextResponse.json({ report }, { status: 201 });
}
