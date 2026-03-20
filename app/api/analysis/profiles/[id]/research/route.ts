import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile, updateProfile } from '@/lib/analysis/supabase-queries';
import { runResearchPipeline } from '@/lib/analysis/research/pipeline';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;

  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Don't restart if already in progress
  if (profile.research_status === 'in_progress') {
    return NextResponse.json({ error: 'Research already in progress' }, { status: 409 });
  }

  // For Vercel, we kick off the pipeline and respond quickly
  // The pipeline runs as a fire-and-forget background task
  // (Vercel functions have a timeout, so heavy lifting happens on Mac Mini worker)

  // Mark as pending for the worker to pick up
  await updateProfile(profileId, { research_status: 'in_progress' });

  // Try to run pipeline directly (will work within Vercel timeout for smaller profiles)
  // Wrap in a non-awaited promise so we don't block the response
  runResearchPipeline(profileId).catch(async (err) => {
    console.error('[research] pipeline error:', err);
    await updateProfile(profileId, { research_status: 'error' });
  });

  return NextResponse.json({
    message: 'Research started',
    profile_id: profileId,
    status: 'in_progress',
  });
}
