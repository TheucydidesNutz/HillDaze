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
  const { data: profile } = await supabaseAdmin
    .from('analysis_profiles')
    .select('id, org_id, fact_sheet, fact_sheet_generated_at')
    .eq('id', profileId)
    .single();

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Also check if there's a pending/running job
  const { data: pendingJob } = await supabaseAdmin
    .from('analysis_jobs')
    .select('id, status')
    .eq('profile_id', profileId)
    .eq('job_type', 'generate_fact_sheet')
    .in('status', ['pending', 'running'])
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    fact_sheet: profile.fact_sheet,
    generated_at: profile.fact_sheet_generated_at,
    generating: !!pendingJob,
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

  // Enqueue
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
}
