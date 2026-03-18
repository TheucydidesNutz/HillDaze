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
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get('status') || 'active';
  const memoryType = request.nextUrl.searchParams.get('type');
  const sort = request.nextUrl.searchParams.get('sort') || 'last_seen_at';

  let query = supabaseAdmin.from('intel_agent_memory').select('*').eq('org_id', orgId).eq('status', status);
  if (memoryType) query = query.eq('memory_type', memoryType);

  const validSorts = ['last_seen_at', 'mention_count', 'confidence', 'created_at'];
  query = query.order(validSorts.includes(sort) ? sort : 'last_seen_at', { ascending: false });

  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { memory_id, content, status: newStatus, org_id } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (content !== undefined) updates.content = content;
  if (newStatus) updates.status = newStatus;

  const { data, error } = await supabaseAdmin.from('intel_agent_memory').update(updates).eq('id', memory_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { memory_id, org_id } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabaseAdmin.from('intel_agent_memory').delete().eq('id', memory_id);
  return NextResponse.json({ success: true });
}
