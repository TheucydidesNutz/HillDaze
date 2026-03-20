import { supabaseAdmin } from '@/lib/supabase';
import { getProfile, updateProfile } from '../supabase-queries';
import { searchCongress } from './congress-search';
import { searchOpenSecrets } from './opensecrets-search';
import { searchCourtListener } from './courtlistener-search';
import { searchWeb } from './web-search';
import { searchWaybackMachine } from './wayback-search';

interface PipelineResult {
  profile_id: string;
  total_items_created: number;
  results: Record<string, { items_created: number; errors: string[] }>;
  skippedSources: string[];
  status: 'complete' | 'error';
}

async function logWorker(
  workerName: string,
  profileId: string | null,
  status: string,
  message: string,
  metadata: Record<string, unknown> = {}
) {
  await supabaseAdmin.from('analysis_worker_logs').insert({
    worker_name: workerName,
    profile_id: profileId,
    status,
    message,
    metadata,
  });
}

export async function runResearchPipeline(profileId: string): Promise<PipelineResult> {
  const profile = await getProfile(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found`);
  }

  const orgId = profile.org_id;

  await logWorker('research-pipeline', profileId, 'started', `Starting research for ${profile.full_name}`);

  // Update status to in_progress
  await updateProfile(profileId, { research_status: 'in_progress' });

  // Set baseline attributes for anomaly detection
  await supabaseAdmin
    .from('analysis_profiles')
    .update({
      baseline_attributes: {
        full_name: profile.full_name,
        position_type: profile.position_type,
        party: profile.party,
        state: profile.state,
        district: profile.district,
        court: profile.court,
        organization: profile.organization,
      },
    })
    .eq('id', profileId);

  // Get API keys from org settings (fall back to env vars for backwards compatibility)
  const { getOrgApiKey } = await import('@/lib/shared/org-api-keys');
  const congressApiKey = await getOrgApiKey(orgId, 'congress_gov') || process.env.CONGRESS_API_KEY || '';
  const openSecretsApiKey = await getOrgApiKey(orgId, 'opensecrets') || process.env.OPENSECRETS_API_KEY || '';
  const courtListenerApiKey = await getOrgApiKey(orgId, 'courtlistener') || process.env.COURTLISTENER_API_KEY || '';

  // Ensure org has sources seeded
  const { data: sources } = await supabaseAdmin
    .from('analysis_source_registry')
    .select('id')
    .eq('org_id', orgId)
    .limit(1);

  if (!sources || sources.length === 0) {
    await supabaseAdmin.rpc('seed_analysis_org_sources', { p_org_id: orgId });
  }

  // Run all research in parallel
  const researchPromises: [string, Promise<{ items_created: number; errors: string[] }>][] = [
    ['web_search', searchWeb(profile, orgId)],
    ['wayback', searchWaybackMachine(profile, orgId)],
  ];

  // Conditional searches based on profile type and API key availability
  if (congressApiKey && profile.position_type === 'congress_member') {
    researchPromises.push(['congress', searchCongress(profile, orgId, congressApiKey)]);
  }

  if (openSecretsApiKey) {
    researchPromises.push(['opensecrets', searchOpenSecrets(profile, orgId, openSecretsApiKey)]);
  }

  if (courtListenerApiKey && profile.position_type === 'jurist') {
    researchPromises.push(['courtlistener', searchCourtListener(profile, orgId, courtListenerApiKey)]);
  }

  const skippedSources: string[] = [];
  if (!congressApiKey && profile.position_type === 'congress_member') {
    skippedSources.push('Congress.gov (no API key configured)');
  }
  if (!openSecretsApiKey) {
    skippedSources.push('OpenSecrets (no API key configured)');
  }
  if (!courtListenerApiKey && profile.position_type === 'jurist') {
    skippedSources.push('CourtListener (no API key configured)');
  }

  const settledResults = await Promise.allSettled(
    researchPromises.map(async ([name, promise]) => {
      const r = await promise;
      return { name, ...r };
    })
  );

  const results: Record<string, { items_created: number; errors: string[] }> = {};
  let totalItems = 0;
  let allFailed = true;

  for (const settled of settledResults) {
    if (settled.status === 'fulfilled') {
      const { name, items_created, errors } = settled.value;
      results[name] = { items_created, errors };
      totalItems += items_created;
      if (items_created > 0 || errors.length === 0) allFailed = false;
    } else {
      // Find which research this was — we can infer from order
      const idx = settledResults.indexOf(settled);
      const name = researchPromises[idx]?.[0] || 'unknown';
      results[name] = { items_created: 0, errors: [settled.reason?.message || 'Unknown error'] };
    }
  }

  const finalStatus = allFailed && researchPromises.length > 0 ? 'error' : 'complete';

  // Update profile status
  await updateProfile(profileId, { research_status: finalStatus as 'complete' | 'error' });

  await logWorker('research-pipeline', profileId, 'completed',
    `Research complete for ${profile.full_name}: ${totalItems} items created`,
    { results, skippedSources }
  );

  // Auto-regenerate soul document if significant new data was added
  if (totalItems >= 10) {
    try {
      const { generateSoulDocument } = await import('@/lib/analysis/agent/generate-soul-document');
      await generateSoulDocument(profile, orgId);
      await logWorker('research-pipeline', profileId, 'running', 'Soul document auto-regenerated after research');
    } catch (err) {
      await logWorker('research-pipeline', profileId, 'running',
        `Soul document auto-regeneration failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    profile_id: profileId,
    total_items_created: totalItems,
    results,
    skippedSources,
    status: finalStatus,
  };
}
