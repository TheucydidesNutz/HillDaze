import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';

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

  // Check for an existing pending/running job
  try {
    const { data: existingJob } = await supabaseAdmin
      .from('analysis_jobs')
      .select('id, status')
      .eq('profile_id', profileId)
      .in('job_type', ['research_quick_update', 'research_full_rerun'])
      .in('status', ['pending', 'running'])
      .limit(1)
      .maybeSingle();

    if (existingJob) {
      return NextResponse.json({ status: 'already_running', job_id: existingJob.id });
    }
  } catch {
    // analysis_jobs table may not exist yet — proceed to try inserting
  }

  const body = await request.json().catch(() => ({}));
  const mode: 'quick_update' | 'full_rerun' = body.mode === 'full_rerun' ? 'full_rerun' : 'quick_update';
  const jobType = mode === 'full_rerun' ? 'research_full_rerun' : 'research_quick_update';

  // Mark profile as in_progress immediately
  await supabaseAdmin
    .from('analysis_profiles')
    .update({ research_status: 'in_progress' })
    .eq('id', profileId);

  // Enqueue job for the Mac Mini worker
  try {
    const { data: job } = await supabaseAdmin
      .from('analysis_jobs')
      .insert({
        profile_id: profileId,
        org_id: profile.org_id,
        job_type: jobType,
        status: 'pending',
        params: { mode },
      })
      .select('id')
      .single();

    return NextResponse.json({
      status: 'queued',
      job_id: job?.id,
      mode,
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to enqueue job. The analysis_jobs table may not exist yet — run the migration.',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
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
