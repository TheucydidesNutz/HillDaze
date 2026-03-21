import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
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
    return NextResponse.json({ status: 'already_running' });
  }

  const body = await request.json().catch(() => ({}));
  const mode: 'quick_update' | 'full_rerun' = body.mode === 'full_rerun' ? 'full_rerun' : 'quick_update';

  // Mark as in_progress immediately
  await updateProfile(profileId, { research_status: 'in_progress' });

  // Determine options based on mode
  let since: string | null = null;
  if (mode === 'quick_update') {
    // Fetch last_research_at from profile (may need direct query since getProfile may not include it)
    const { data: profileData } = await supabaseAdmin
      .from('analysis_profiles')
      .select('last_research_at')
      .eq('id', profileId)
      .single();
    since = profileData?.last_research_at || null;
    // If never researched, since stays null → behaves like full_rerun
  }

  // For full_rerun: check if profile name changed since last bioguide resolution
  let clearBioguideCache = false;
  if (mode === 'full_rerun') {
    try {
      const { data: profileData } = await supabaseAdmin
        .from('analysis_profiles')
        .select('external_ids, full_name')
        .eq('id', profileId)
        .single();
      const externalIds = (profileData?.external_ids || {}) as Record<string, string>;
      if (externalIds.bioguide_resolved_for && externalIds.bioguide_resolved_for !== profileData?.full_name) {
        clearBioguideCache = true;
      }
    } catch { /* column may not exist yet */ }
  }

  // Fire the pipeline asynchronously
  runResearchPipeline(profileId, {
    since,
    clearBioguideCache,
    mode,
  }).catch(async (err) => {
    console.error(`[research] Pipeline error for ${profileId}:`, err);
    await updateProfile(profileId, { research_status: 'error' });
  });

  return NextResponse.json({
    status: 'started',
    mode,
    since,
  });
}

// GET endpoint to poll for status + research report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;

  const { data: profile } = await supabaseAdmin
    .from('analysis_profiles')
    .select('id, research_status, research_report, last_research_at')
    .eq('id', profileId)
    .single();

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    research_status: profile.research_status,
    research_report: profile.research_report,
    last_research_at: profile.last_research_at,
  });
}
