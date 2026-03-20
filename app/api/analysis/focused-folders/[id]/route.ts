import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: folder } = await supabaseAdmin
    .from('analysis_focused_folders')
    .select('*')
    .eq('id', id)
    .single();

  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(folder.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Get items with their data item details
  const { data: folderItems } = await supabaseAdmin
    .from('analysis_focused_folder_items')
    .select('id, data_item_id, storage_path, created_at')
    .eq('folder_id', id)
    .order('created_at');

  // Get data item details for items that have data_item_id
  const dataItemIds = (folderItems || []).filter(fi => fi.data_item_id).map(fi => fi.data_item_id);
  let dataItems: Record<string, unknown>[] = [];
  if (dataItemIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('analysis_data_items')
      .select('id, title, category, summary, source_name, item_date')
      .in('id', dataItemIds);
    dataItems = data || [];
  }

  const dataItemMap = new Map(dataItems.map(d => [d.id as string, d]));

  const items = (folderItems || []).map(fi => ({
    ...fi,
    data_item: fi.data_item_id ? dataItemMap.get(fi.data_item_id) || null : null,
  }));

  return NextResponse.json({ folder, items });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: folder } = await supabaseAdmin
    .from('analysis_focused_folders')
    .select('org_id')
    .eq('id', id)
    .single();

  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(folder.org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabaseAdmin.from('analysis_focused_folders').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
