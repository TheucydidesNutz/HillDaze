import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profileId = request.nextUrl.searchParams.get('profile_id');
  const orgId = request.nextUrl.searchParams.get('org_id');
  if (!profileId || !orgId) return NextResponse.json({ error: 'profile_id and org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: folders } = await supabaseAdmin
    .from('analysis_focused_folders')
    .select('*')
    .eq('profile_id', profileId)
    .eq('org_id', orgId)
    .order('folder_type')
    .order('name');

  // Get item counts per folder
  const folderIds = (folders || []).map(f => f.id);
  const { data: itemCounts } = await supabaseAdmin
    .from('analysis_focused_folder_items')
    .select('folder_id')
    .in('folder_id', folderIds.length > 0 ? folderIds : ['__none__']);

  const countMap = new Map<string, number>();
  (itemCounts || []).forEach(i => {
    countMap.set(i.folder_id, (countMap.get(i.folder_id) || 0) + 1);
  });

  const foldersWithCounts = (folders || []).map(f => ({
    ...f,
    item_count: countMap.get(f.id) || 0,
  }));

  return NextResponse.json({ folders: foldersWithCounts });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { profile_id, org_id, folder_type, name, description } = body;

  if (!profile_id || !org_id || !folder_type || !name) {
    return NextResponse.json({ error: 'profile_id, org_id, folder_type, and name required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('analysis_focused_folders')
    .insert({ profile_id, org_id, folder_type, name, description: description || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });

  return NextResponse.json({ folder: data }, { status: 201 });
}
