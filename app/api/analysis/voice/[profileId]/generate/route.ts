import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';
import { generateSoulDocument } from '@/lib/analysis/agent/generate-soul-document';

export async function POST(
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
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fire and forget the generation
  generateSoulDocument(profile, profile.org_id).catch(err => {
    console.error('[voice/generate] error:', err);
  });

  return NextResponse.json({ message: 'Soul document generation started' });
}
