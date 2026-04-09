import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug, updateWorkspace } from '@/lib/analysis/workspace-queries';
import { generateWorkspaceSoulDoc } from '@/lib/analysis/agent/generate-workspace-soul-doc';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const orgId = request.nextUrl.searchParams.get('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const workspace = await getWorkspaceBySlug(orgId, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  return NextResponse.json({
    soul_doc: workspace.soul_doc,
    soul_doc_md: workspace.soul_doc_md,
    version: workspace.soul_doc_version,
  });
}

// Manual update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { org_id, soul_doc, soul_doc_md } = body as {
    org_id: string;
    soul_doc?: Record<string, unknown>;
    soul_doc_md?: string;
  };

  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Save current version to history
  await supabaseAdmin.from('workspace_soul_doc_history').insert({
    workspace_id: workspace.id,
    version: workspace.soul_doc_version,
    soul_doc: workspace.soul_doc,
    soul_doc_md: workspace.soul_doc_md,
    changed_by: 'user',
    description: 'Manual update',
  });

  const newVersion = workspace.soul_doc_version + 1;
  const updated = await updateWorkspace(workspace.id, {
    soul_doc: soul_doc || workspace.soul_doc,
    soul_doc_md: soul_doc_md !== undefined ? soul_doc_md : workspace.soul_doc_md,
    soul_doc_version: newVersion,
  });

  if (!updated) return NextResponse.json({ error: 'Failed to update soul doc' }, { status: 500 });

  return NextResponse.json({
    soul_doc: updated.soul_doc,
    soul_doc_md: updated.soul_doc_md,
    version: newVersion,
  });
}

// Trigger regeneration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { org_id } = body as { org_id: string };
  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Save current to history
  if (workspace.soul_doc_md) {
    await supabaseAdmin.from('workspace_soul_doc_history').insert({
      workspace_id: workspace.id,
      version: workspace.soul_doc_version,
      soul_doc: workspace.soul_doc,
      soul_doc_md: workspace.soul_doc_md,
      changed_by: 'system',
      description: 'Pre-regeneration snapshot',
    });
  }

  const { content, markdown } = await generateWorkspaceSoulDoc(workspace, org_id);
  const newVersion = workspace.soul_doc_version + 1;

  const updated = await updateWorkspace(workspace.id, {
    soul_doc: content,
    soul_doc_md: markdown,
    soul_doc_version: newVersion,
  });

  if (!updated) return NextResponse.json({ error: 'Failed to save generated soul doc' }, { status: 500 });

  return NextResponse.json({
    soul_doc: content,
    soul_doc_md: markdown,
    version: newVersion,
  });
}
