import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getDocument, deleteDocument, getUserOrgMembership } from '@/lib/intel/supabase-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type RouteParams = { params: Promise<{ 'doc-id': string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'doc-id': docId } = await params;
  const doc = await getDocument(docId);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(doc.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(doc);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'doc-id': docId } = await params;
  const doc = await getDocument(docId);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(doc.org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.folder_id !== undefined) {
    updates.folder_id = body.folder_id;

    // Walk up the tree to the root folder to determine the effective type
    if (body.folder_id) {
      let walkId: string | null = body.folder_id;
      while (walkId) {
        const result = await supabaseAdmin
          .from('intel_document_folders')
          .select('folder_type, parent_id')
          .eq('id', walkId)
          .single();
        const ancestor = result.data as { folder_type: string; parent_id: string | null } | null;
        if (!ancestor) break;
        if (!ancestor.parent_id) {
          updates.folder = ancestor.folder_type === 'reference' ? 'reference' : 'deep_dive';
          break;
        }
        walkId = ancestor.parent_id;
      }
    }
  }

  const { data: updated } = await supabaseAdmin
    .from('intel_documents')
    .update(updates)
    .eq('id', docId)
    .select()
    .single();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'doc-id': docId } = await params;
  const doc = await getDocument(docId);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(doc.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete from storage
  await supabaseAdmin.storage.from('intel').remove([doc.storage_path]);
  const summaryPath = doc.storage_path
    .replace('/original/', '/summaries/')
    .replace(/\.[^.]+$/, '.json');
  await supabaseAdmin.storage.from('intel').remove([summaryPath]);

  // Delete from database
  const success = await deleteDocument(docId);
  if (!success) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });

  return NextResponse.json({ success: true });
}
