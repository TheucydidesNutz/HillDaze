import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type RouteParams = { params: Promise<{ 'folder-id': string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'folder-id': folderId } = await params;

  const { data: folder } = await supabaseAdmin
    .from('intel_document_folders')
    .select('*')
    .eq('id', folderId)
    .single();

  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(folder.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Get doc count
  const { count } = await supabaseAdmin
    .from('intel_documents')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId);

  // Get subfolder count
  const { count: subfolderCount } = await supabaseAdmin
    .from('intel_document_folders')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', folderId);

  return NextResponse.json({
    ...folder,
    doc_count: count || 0,
    subfolder_count: subfolderCount || 0,
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'folder-id': folderId } = await params;

  const { data: folder } = await supabaseAdmin
    .from('intel_document_folders')
    .select('*')
    .eq('id', folderId)
    .single();

  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(folder.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Block renaming default root folders
  const isRootDefault = !folder.parent_id &&
    (folder.folder_type === 'deep_dive' || folder.folder_type === 'reference');

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (isRootDefault) {
      return NextResponse.json({ error: 'Cannot rename default folders' }, { status: 400 });
    }
    updates.name = body.name;
    updates.slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);
  }
  if (body.description !== undefined) updates.description = body.description;
  // folder_type is now determined by ancestry — no manual toggle

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(folder);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('intel_document_folders')
    .update(updates)
    .eq('id', folderId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'folder-id': folderId } = await params;

  const { data: folder } = await supabaseAdmin
    .from('intel_document_folders')
    .select('*')
    .eq('id', folderId)
    .single();

  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Prevent deleting root default folders
  if (!folder.parent_id) {
    return NextResponse.json({ error: 'Cannot delete default folders' }, { status: 400 });
  }

  const member = await getUserOrgMembership(folder.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check for subfolders
  const { count: subfolderCount } = await supabaseAdmin
    .from('intel_document_folders')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', folderId);

  if (subfolderCount && subfolderCount > 0) {
    return NextResponse.json({ error: 'Folder has subfolders. Move or delete them first.' }, { status: 400 });
  }

  // Check for documents
  const { count: docCount } = await supabaseAdmin
    .from('intel_documents')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId);

  if (docCount && docCount > 0) {
    return NextResponse.json({ error: 'Folder contains documents. Move them first.' }, { status: 400 });
  }

  await supabaseAdmin.from('intel_document_folders').delete().eq('id', folderId);

  return NextResponse.json({ success: true });
}
