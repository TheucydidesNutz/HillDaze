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
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Get soul document ID
  const { data: soulDoc } = await supabaseAdmin
    .from('analysis_soul_documents')
    .select('id')
    .eq('profile_id', profileId)
    .single();

  if (!soulDoc) return NextResponse.json({ proposals: [] });

  const { data: proposals } = await supabaseAdmin
    .from('analysis_soul_document_proposals')
    .select('*')
    .eq('soul_document_id', soulDoc.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ proposals: proposals || [] });
}
