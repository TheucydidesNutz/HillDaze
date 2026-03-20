import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: folderId } = await params;
  const body = await request.json();
  const { data_item_id, storage_path } = body;

  const { data: folder } = await supabaseAdmin
    .from('analysis_focused_folders')
    .select('org_id')
    .eq('id', folderId)
    .single();

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

  const member = await getUserOrgMembership(folder.org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('analysis_focused_folder_items')
    .insert({ folder_id: folderId, data_item_id: data_item_id || null, storage_path: storage_path || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: folderId } = await params;
  const itemId = request.nextUrl.searchParams.get('item_id');
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

  const { data: folder } = await supabaseAdmin
    .from('analysis_focused_folders')
    .select('org_id')
    .eq('id', folderId)
    .single();

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

  const member = await getUserOrgMembership(folder.org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabaseAdmin.from('analysis_focused_folder_items').delete().eq('id', itemId);
  return NextResponse.json({ success: true });
}
