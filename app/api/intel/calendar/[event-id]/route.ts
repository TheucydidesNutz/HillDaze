import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type Params = { params: Promise<{ 'event-id': string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'event-id': id } = await params;
  const { data: event } = await supabaseAdmin.from('intel_calendar_events').select('org_id').eq('id', id).single();
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(event.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const allowed = ['title', 'event_type', 'event_date', 'end_date', 'description', 'action_needed', 'status'];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) { if (k in body) updates[k] = body[k]; }

  const { data, error } = await supabaseAdmin.from('intel_calendar_events').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'event-id': id } = await params;
  const { data: event } = await supabaseAdmin.from('intel_calendar_events').select('org_id').eq('id', id).single();
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(event.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabaseAdmin.from('intel_calendar_events').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
