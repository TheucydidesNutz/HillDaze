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

  const { data } = await supabaseAdmin
    .from('analysis_conversations')
    .select('id, title, created_at, updated_at')
    .eq('profile_id', profileId)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ conversations: data || [] });
}
