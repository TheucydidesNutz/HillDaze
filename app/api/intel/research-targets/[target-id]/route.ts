import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type Params = { params: Promise<{ 'target-id': string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': id } = await params;

  // Support lookup by slug or id
  let query = supabaseAdmin.from('intel_research_targets').select('*');
  if (id.match(/^[0-9a-f-]{36}$/)) {
    query = query.eq('id', id);
  } else {
    query = query.eq('slug', id);
  }
  const { data } = await query.single();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(data.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': id } = await params;
  const { data: target } = await supabaseAdmin.from('intel_research_targets').select('org_id').eq('id', id).single();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(target.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const allowed = ['name', 'description', 'tracking_brief', 'search_terms', 'icon', 'status'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (body.name) updates.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin.from('intel_research_targets').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': id } = await params;
  const { data: target } = await supabaseAdmin.from('intel_research_targets').select('org_id').eq('id', id).single();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(target.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabaseAdmin.from('intel_research_targets').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
