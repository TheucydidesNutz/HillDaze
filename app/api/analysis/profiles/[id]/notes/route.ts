import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: notes } = await supabaseAdmin
    .from('analysis_profile_notes')
    .select('*')
    .eq('profile_id', profileId)
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ notes: notes || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member || member.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { note_text } = body;
  if (!note_text?.trim()) return NextResponse.json({ error: 'note_text required' }, { status: 400 });

  const { data: note, error } = await supabaseAdmin
    .from('analysis_profile_notes')
    .insert({
      profile_id: profileId,
      org_id: profile.org_id,
      user_id: user.id,
      note_text: note_text.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });

  return NextResponse.json({ note }, { status: 201 });
}
