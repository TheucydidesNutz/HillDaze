import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { profileId } = await params;
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: config } = await supabaseAdmin
    .from('analysis_monitoring_configs')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  return NextResponse.json({ config: config || null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { profileId } = await params;
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member || member.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.frequency) updates.frequency = body.frequency;
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (body.search_queries) updates.search_queries = body.search_queries;

  const { data, error } = await supabaseAdmin
    .from('analysis_monitoring_configs')
    .update(updates)
    .eq('profile_id', profileId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  return NextResponse.json({ config: data });
}
