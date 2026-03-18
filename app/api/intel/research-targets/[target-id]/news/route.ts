import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'target-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': targetId } = await params;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

  const { data: target } = await supabaseAdmin.from('intel_research_targets').select('org_id').eq('id', targetId).single();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(target.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('intel_research_target_news')
    .select('*, news_item:intel_news_items(*)')
    .eq('target_id', targetId)
    .order('matched_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json((data || []).map((d: Record<string, unknown>) => d.news_item).filter(Boolean));
}
