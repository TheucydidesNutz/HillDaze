import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';

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

  // Check for existing pending/running job
  const { data: existingJob } = await supabaseAdmin
    .from('analysis_jobs')
    .select('id')
    .eq('profile_id', profileId)
    .eq('job_type', 'generate_voice')
    .in('status', ['pending', 'running'])
    .limit(1)
    .maybeSingle();

  if (existingJob) {
    return NextResponse.json({ status: 'already_queued', job_id: existingJob.id });
  }

  // Enqueue for Mac Mini worker
  const { data: job } = await supabaseAdmin
    .from('analysis_jobs')
    .insert({
      profile_id: profileId,
      org_id: profile.org_id,
      job_type: 'generate_voice',
      status: 'pending',
    })
    .select('id')
    .single();

  return NextResponse.json({ status: 'queued', job_id: job?.id });
}
