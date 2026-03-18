import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const roleType = request.nextUrl.searchParams.get('roleType');
  const sort = request.nextUrl.searchParams.get('sort') || 'mention_count';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

  let query = supabaseAdmin.from('intel_stakeholders').select('*').eq('org_id', orgId);
  if (roleType) query = query.eq('role_type', roleType);

  const validSorts = ['mention_count', 'last_mentioned_at', 'influence_score'];
  const sortCol = validSorts.includes(sort) ? sort : 'mention_count';
  query = query.order(sortCol, { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, name, title, organization, role_type, stance, notes } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.from('intel_stakeholders').insert({
    org_id,
    name,
    title: title || null,
    organization: organization || null,
    role_type: role_type || 'other',
    stance: stance || null,
    consultant_notes: notes || null,
    mention_count: 0,
    mention_sources: [],
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
