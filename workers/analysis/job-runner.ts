/**
 * Analysis Job Runner — Mac Mini worker
 *
 * Polls analysis_jobs for pending jobs every 5 seconds.
 * Processes one job at a time, sequentially.
 * Handles: research pipelines, fact sheet generation, voice/soul document generation.
 *
 * Run with: npx tsx workers/analysis/job-runner.ts
 * Or via PM2: pm2 start ecosystem.config.js --only analysis-job-runner
 */

import { supabase, log } from './worker-utils';

const WORKER = 'analysis-job-runner';
const POLL_INTERVAL_MS = 5000;

interface Job {
  id: string;
  profile_id: string;
  org_id: string;
  job_type: string;
  status: string;
  params: Record<string, unknown>;
}

async function main() {
  log(WORKER, 'Job runner started. Polling every 5 seconds...');

  while (true) {
    try {
      await pollAndProcess();
    } catch (err) {
      log(WORKER, `Poll cycle error: ${err instanceof Error ? err.message : err}`);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function pollAndProcess() {
  // Pick the oldest pending job
  const { data: jobs, error } = await supabase
    .from('analysis_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    log(WORKER, `Error polling jobs: ${error.message}`);
    return;
  }

  if (!jobs || jobs.length === 0) return;

  const job = jobs[0] as Job;
  log(WORKER, `Processing job ${job.id}: ${job.job_type} for profile ${job.profile_id}`);

  // Claim the job — set to running
  const { error: claimError } = await supabase
    .from('analysis_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending'); // Only claim if still pending (prevents double-processing)

  if (claimError) {
    log(WORKER, `Failed to claim job ${job.id}: ${claimError.message}`);
    return;
  }

  try {
    let result: Record<string, unknown> = {};

    switch (job.job_type) {
      case 'research_quick_update':
      case 'research_full_rerun':
        result = await runResearchJob(job);
        break;

      case 'generate_fact_sheet':
        result = await runFactSheetJob(job);
        break;

      case 'generate_voice':
        result = await runVoiceJob(job);
        break;

      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // Mark complete
    await supabase
      .from('analysis_jobs')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        result,
      })
      .eq('id', job.id);

    log(WORKER, `Job ${job.id} completed successfully`);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(WORKER, `Job ${job.id} failed: ${errorMsg}`);

    // Mark job as error
    await supabase
      .from('analysis_jobs')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: errorMsg,
      })
      .eq('id', job.id);

    // Reset profile research_status if it was a research job
    if (job.job_type.startsWith('research_')) {
      await supabase
        .from('analysis_profiles')
        .update({ research_status: 'error' })
        .eq('id', job.profile_id);
    }
  }
}

// ── Job Handlers ──────────────────────────────────────────────────

async function runResearchJob(job: Job): Promise<Record<string, unknown>> {
  // Import dynamically to avoid loading heavy deps at startup
  const { runResearchPipeline } = await import('../../lib/analysis/research/pipeline');

  const mode = job.job_type === 'research_full_rerun' ? 'full_rerun' : 'quick_update';

  // For quick_update, get the since timestamp
  let since: string | null = null;
  if (mode === 'quick_update') {
    const { data: profileData } = await supabase
      .from('analysis_profiles')
      .select('last_research_at')
      .eq('id', job.profile_id)
      .single();
    since = profileData?.last_research_at || null;
  }

  // For full_rerun, check if bioguide cache should be cleared
  let clearBioguideCache = false;
  if (mode === 'full_rerun') {
    try {
      const { data: profileData } = await supabase
        .from('analysis_profiles')
        .select('external_ids, full_name')
        .eq('id', job.profile_id)
        .single();
      const externalIds = (profileData?.external_ids || {}) as Record<string, string>;
      if (externalIds.bioguide_resolved_for && externalIds.bioguide_resolved_for !== profileData?.full_name) {
        clearBioguideCache = true;
      }
    } catch { /* column may not exist */ }
  }

  const result = await runResearchPipeline(job.profile_id, {
    since,
    clearBioguideCache,
    mode,
  });

  return result as unknown as Record<string, unknown>;
}

async function runFactSheetJob(job: Job): Promise<Record<string, unknown>> {
  const { generateFactSheet } = await import('../../lib/analysis/research/generate-fact-sheet');
  const factSheet = await generateFactSheet(job.profile_id);
  return { fact_sheet: factSheet };
}

async function runVoiceJob(job: Job): Promise<Record<string, unknown>> {
  const { generateSoulDocument } = await import('../../lib/analysis/agent/generate-soul-document');

  // Need to get the profile for the generate function
  const { data: profile } = await supabase
    .from('analysis_profiles')
    .select('*')
    .eq('id', job.profile_id)
    .single();

  if (!profile) throw new Error(`Profile ${job.profile_id} not found`);

  await generateSoulDocument(profile, job.org_id);
  return { generated: true };
}

// ── Entry point ───────────────────────────────────────────────────

main().catch(err => {
  log(WORKER, `Fatal error: ${err}`);
  process.exit(1);
});
