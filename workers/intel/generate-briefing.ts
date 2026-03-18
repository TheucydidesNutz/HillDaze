import { supabase, callClaude, logApiUsage, log, getAllActiveOrgs } from './worker-utils';

async function generateForOrg(orgId: string) {
  const { data: org } = await supabase.from('intel_organizations').select('name').eq('id', orgId).single();
  const { data: soulDoc } = await supabase.from('intel_soul_documents').select('content').eq('org_id', orgId).order('version', { ascending: false }).limit(1).single();
  const { data: news } = await supabase.from('intel_news_items').select('title, source_type, summary').eq('org_id', orgId).order('ingested_at', { ascending: false }).limit(20);
  const { data: memories } = await supabase.from('intel_agent_memory').select('subject, content').eq('org_id', orgId).eq('status', 'active').limit(10);

  const newsText = (news || []).map((n: any) => `- [${n.source_type}] ${n.title}`).join('\n') || 'No recent news.';
  const memText = (memories || []).map((m: any) => `- ${m.subject}: ${m.content}`).join('\n') || 'No observations.';

  const result = await callClaude(
    `You are the intelligence briefing writer for ${org?.name}. Write a concise 3-5 paragraph executive briefing.`,
    `Focus: ${(soulDoc?.content || '').substring(0, 500)}\nRecent news:\n${newsText}\nObservations:\n${memText}\n\nWrite the briefing.`,
    2048
  );

  await logApiUsage(orgId, 'weekly_briefing', 'claude-sonnet-4-20250514', result.inputTokens, result.outputTokens);

  const now = new Date();
  await supabase.from('intel_briefings').insert({
    org_id: orgId, briefing_type: 'weekly', content: {}, executive_summary: result.text,
    period_start: new Date(now.getTime() - 7 * 864e5).toISOString().split('T')[0],
    period_end: now.toISOString().split('T')[0], generated_by: 'system',
  });
  log('briefing', `${org?.name}: generated`);
}

async function main() {
  log('briefing', 'Starting weekly briefing generation');
  for (const org of await getAllActiveOrgs()) await generateForOrg(org.id);
  log('briefing', 'Done');
}

main().catch(err => { log('briefing', `Fatal: ${err}`); process.exit(1); });
