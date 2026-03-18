import { supabase, callClaude, logApiUsage, log, getAllActiveOrgs } from './worker-utils';

async function checkForOrg(orgId: string) {
  const { data: org } = await supabase.from('intel_organizations').select('name').eq('id', orgId).single();
  const { data: soulDoc } = await supabase.from('intel_soul_documents').select('content').eq('org_id', orgId).order('version', { ascending: false }).limit(1).single();
  const { data: memories } = await supabase.from('intel_agent_memory').select('subject, content, memory_type').eq('org_id', orgId).eq('status', 'active').limit(20);
  const { data: news } = await supabase.from('intel_news_items').select('title, source_type').eq('org_id', orgId).order('ingested_at', { ascending: false }).limit(20);

  const result = await callClaude(
    `Analyze alignment between soul doc and activity. Return JSON: {"dormant_topics":[],"unstated_topics":[],"priority_mismatches":[],"objective_progress":[],"overall_health_score":0.75,"narrative":"..."}`,
    `Soul doc:\n${(soulDoc?.content || '').substring(0, 2000)}\n\nMemories:\n${(memories || []).map((m: any) => `${m.subject}: ${m.content}`).join('\n')}\n\nNews:\n${(news || []).map((n: any) => n.title).join('\n')}`,
    4096
  );

  await logApiUsage(orgId, 'soul_health_check', 'claude-sonnet-4-20250514', result.inputTokens, result.outputTokens);

  try {
    const parsed = JSON.parse(result.text);
    await supabase.from('intel_soul_health_checks').insert({
      org_id: orgId, check_period: '60 days',
      dormant_topics: parsed.dormant_topics || [], unstated_topics: parsed.unstated_topics || [],
      priority_mismatches: parsed.priority_mismatches || [], objective_progress: parsed.objective_progress || [],
      overall_health_score: parsed.overall_health_score || 0, narrative: parsed.narrative || '',
    });
    log('health', `${org?.name}: score ${parsed.overall_health_score}`);
  } catch { log('health', `${org?.name}: parse error`); }
}

async function main() {
  log('health', 'Starting soul health checks');
  for (const org of await getAllActiveOrgs()) await checkForOrg(org.id);
  log('health', 'Done');
}

main().catch(err => { log('health', `Fatal: ${err}`); process.exit(1); });
