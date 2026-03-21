import { supabase, getAnthropic, log, logApiUsage } from './worker-utils';

const WORKER = 'analysis-monitoring';

// Frequency intervals in milliseconds
const FREQ_MS: Record<string, number> = {
  every_6_hours: 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

async function main() {
  log(WORKER, 'Checking for due monitoring configs...');

  // Get active configs where last_run_at + interval < now
  const { data: configs, error } = await supabase
    .from('analysis_monitoring_configs')
    .select('*, profile:analysis_profiles(id, full_name, org_id, position_type, party, state)')
    .eq('is_active', true);

  if (error) {
    log(WORKER, `Error: ${error.message}`);
    process.exit(1);
  }

  if (!configs || configs.length === 0) {
    log(WORKER, 'No active monitoring configs');
    return;
  }

  const now = Date.now();

  for (const config of configs) {
    const interval = FREQ_MS[config.frequency] || FREQ_MS.daily;
    const lastRun = config.last_run_at ? new Date(config.last_run_at).getTime() : 0;

    if (now - lastRun < interval) continue; // Not due yet

    const profile = config.profile as { id: string; full_name: string; org_id: string; position_type: string; party: string | null; state: string | null } | null;
    if (!profile) continue;

    log(WORKER, `Running monitoring for ${profile.full_name}`);

    const queries = (config.search_queries || []) as Array<{ query: string; enabled: boolean }>;
    const activeQueries = queries.filter(q => q.enabled !== false);

    if (activeQueries.length === 0) {
      // Default queries based on profile
      activeQueries.push(
        { query: `"${profile.full_name}" recent news`, enabled: true },
        { query: `"${profile.full_name}" speech OR statement OR press conference`, enabled: true },
      );
    }

    let totalCreated = 0;

    for (const sq of activeQueries) {
      try {
        const client = getAnthropic();
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          tools: [{ type: 'web_search_20260209' as const, name: 'web_search', max_uses: 5 }],
          messages: [{
            role: 'user',
            content: `Search for: ${sq.query}\n\nReturn ONLY a JSON array about ${profile.full_name}. Each: {"title":"...","date":"YYYY-MM-DD or null","source_url":"...","source_name":"...","summary":"...","category":"speech|news|position|podcast|social_media","key_quotes":["..."]}. Return [] if nothing found.`,
          }],
        });

        await logApiUsage(profile.org_id, 'analysis_monitoring', 'claude-sonnet-4-20250514', response.usage.input_tokens, response.usage.output_tokens);

        const textBlock = response.content.find(b => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') continue;

        let items: Array<{ title: string; date: string | null; source_url: string; source_name: string; summary: string; category: string; key_quotes: string[] }> = [];
        try {
          let t = textBlock.text.trim();
          if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          items = JSON.parse(t);
        } catch { continue; }

        if (!Array.isArray(items)) continue;

        for (const item of items) {
          if (!item.source_url || !item.title) continue;

          // Deduplicate
          const { data: existing } = await supabase
            .from('analysis_data_items')
            .select('id')
            .eq('profile_id', profile.id)
            .eq('source_url', item.source_url)
            .limit(1)
            .maybeSingle();

          if (existing) continue;

          // Simple anomaly check
          const text = `${item.title} ${item.summary}`.toLowerCase();
          const lastName = profile.full_name.split(' ').pop()?.toLowerCase() || '';
          const badTerms = ['arrested', 'obituary', 'wedding', 'athlete', 'musician'];
          const isAnomaly = badTerms.some(t => text.includes(t)) || (text.length > 50 && !text.includes(lastName));

          await supabase.from('analysis_data_items').insert({
            profile_id: profile.id,
            org_id: profile.org_id,
            category: item.category || 'news',
            title: item.title,
            summary: item.summary,
            key_quotes: item.key_quotes || [],
            key_topics: [],
            source_url: item.source_url,
            source_name: item.source_name,
            source_trust_level: 'default',
            item_date: item.date || null,
            verification_status: isAnomaly ? 'unverified' : 'verified',
            anomaly_flags: isAnomaly ? { flags: [{ type: 'auto_check', reason: 'Monitoring auto-check flagged', score: 0.5 }] } : {},
          });
          totalCreated++;
        }
      } catch (err) {
        log(WORKER, `  Search failed for "${sq.query}": ${err}`);
      }
    }

    // Update last_run_at
    await supabase
      .from('analysis_monitoring_configs')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', config.id);

    await supabase.from('analysis_worker_logs').insert({
      worker_name: WORKER,
      profile_id: profile.id,
      status: 'completed',
      message: `Monitoring: ${totalCreated} new items`,
      metadata: { queries_run: activeQueries.length },
    });

    log(WORKER, `  ${totalCreated} new items for ${profile.full_name}`);
  }

  log(WORKER, 'Monitoring check complete');
}

main().catch(err => {
  log(WORKER, `Fatal: ${err}`);
  process.exit(1);
});
