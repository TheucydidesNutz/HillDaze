import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parentId = request.nextUrl.searchParams.get('parent_profile_id');
  const orgId = request.nextUrl.searchParams.get('org_id');
  if (!parentId || !orgId) return NextResponse.json({ error: 'parent_profile_id and org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: staffers } = await supabaseAdmin
    .from('analysis_profiles')
    .select('*')
    .eq('parent_profile_id', parentId)
    .eq('profile_type', 'staffer')
    .eq('org_id', orgId)
    .order('full_name');

  return NextResponse.json({ staffers: staffers || [] });
}
