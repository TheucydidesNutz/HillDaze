import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug, updateWorkspace } from '@/lib/analysis/workspace-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug, id } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { org_id, action } = body as { org_id: string; action: 'approve' | 'reject' };
  if (!org_id || !action) {
    return NextResponse.json({ error: 'org_id and action (approve/reject) required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || !['super_admin', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data: proposal } = await supabaseAdmin
    .from('workspace_soul_doc_proposals')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status !== 'pending') {
    return NextResponse.json({ error: 'Proposal already reviewed' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Update proposal status
  await supabaseAdmin
    .from('workspace_soul_doc_proposals')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: now,
    })
    .eq('id', id);

  // If approved, apply changes to soul doc
  if (action === 'approve') {
    // Save current to history
    await supabaseAdmin.from('workspace_soul_doc_history').insert({
      workspace_id: workspace.id,
      version: workspace.soul_doc_version,
      soul_doc: workspace.soul_doc,
      soul_doc_md: workspace.soul_doc_md,
      changed_by: 'user',
      description: `Approved proposal: ${proposal.description || 'No description'}`,
    });

    const mergedDoc = { ...workspace.soul_doc, ...proposal.proposed_changes };
    await updateWorkspace(workspace.id, {
      soul_doc: mergedDoc,
      soul_doc_version: workspace.soul_doc_version + 1,
    });
  }

  return NextResponse.json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' });
}
