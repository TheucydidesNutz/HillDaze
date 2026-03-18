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

  const [{ data: feeds }, { data: competitive }] = await Promise.all([
    supabaseAdmin.from('intel_rss_feed_config').select('*').eq('org_id', orgId),
    supabaseAdmin.from('intel_competitive_sources').select('*').eq('org_id', orgId),
  ]);

  return NextResponse.json({ feeds: feeds || [], competitive: competitive || [] });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, type } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (type === 'competitive') {
    const { data, error } = await supabaseAdmin
      .from('intel_competitive_sources')
      .insert({
        org_id,
        name: body.name,
        url: body.url,
        relationship: body.relationship || 'neutral',
        description: body.description || null,
        active: true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  const { data, error } = await supabaseAdmin
    .from('intel_rss_feed_config')
    .insert({
      org_id,
      feed_url: body.feed_url,
      feed_name: body.feed_name,
      category: body.category || 'general',
      active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { feed_id, type, org_id } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const table = type === 'competitive' ? 'intel_competitive_sources' : 'intel_rss_feed_config';
  await supabaseAdmin.from(table).delete().eq('id', feed_id);
  return NextResponse.json({ success: true });
}
