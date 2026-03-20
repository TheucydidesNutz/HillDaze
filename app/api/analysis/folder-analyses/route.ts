import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = request.nextUrl;
  const profileId = url.searchParams.get('profile_id');
  const orgId = url.searchParams.get('org_id');

  if (!profileId || !orgId) {
    return NextResponse.json({ error: 'profile_id and org_id are required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('analysis_folder_analyses')
    .select('*')
    .eq('profile_id', profileId)
    .eq('org_id', orgId)
    .order('folder_path');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch folder analyses' }, { status: 500 });
  }

  return NextResponse.json({ analyses: data || [] });
}
