import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';

// GET — return existing fact sheet
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;

  // Use select('*') to avoid 400 if PostgREST schema cache hasn't refreshed
  // after adding fact_sheet / fact_sheet_generated_at columns
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('analysis_profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (profileError || !profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Check for pending/running job — wrap in try/catch in case analysis_jobs table
  // hasn't been created yet or PostgREST hasn't cached it
  let generating = false;
  try {
    const { data: pendingJob } = await supabaseAdmin
      .from('analysis_jobs')
      .select('id, status')
      .eq('profile_id', profileId)
      .eq('job_type', 'generate_fact_sheet')
      .in('status', ['pending', 'running'])
      .limit(1)
      .maybeSingle();
    generating = !!pendingJob;
  } catch {
    // analysis_jobs table may not exist yet
  }

  return NextResponse.json({
    fact_sheet: profile.fact_sheet ?? null,
    generated_at: profile.fact_sheet_generated_at ?? null,
    generating,
  });
}

// POST — enqueue fact sheet generation for Mac Mini worker
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

  // Check for existing pending/running job
  try {
    const { data: existingJob } = await supabaseAdmin
      .from('analysis_jobs')
      .select('id')
      .eq('profile_id', profileId)
      .eq('job_type', 'generate_fact_sheet')
      .in('status', ['pending', 'running'])
      .limit(1)
      .maybeSingle();

    if (existingJob) {
      return NextResponse.json({ status: 'already_queued', job_id: existingJob.id });
    }
  } catch {
    // analysis_jobs table may not exist — fall through to try inserting
  }

  // Enqueue
  try {
    const { data: job } = await supabaseAdmin
      .from('analysis_jobs')
      .insert({
        profile_id: profileId,
        org_id: profile.org_id,
        job_type: 'generate_fact_sheet',
        status: 'pending',
      })
      .select('id')
      .single();

    return NextResponse.json({ status: 'queued', job_id: job?.id });
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to enqueue job. The analysis_jobs table may not exist yet — run the migration.',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
