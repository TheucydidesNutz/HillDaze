import { supabase, callClaude, logApiUsage, log, getAllActiveOrgs } from './worker-utils';

async function generateForOrg(orgId: string) {
  const { data: org } = await supabase.from('intel_organizations').select('name').eq('id', orgId).single();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const monthStr = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split('T')[0];

  const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString();
  const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString();

  const { count: convCount } = await supabase.from('intel_conversations').select('*', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', start).lte('created_at', end);
  const { data: news } = await supabase.from('intel_news_items').select('title, source_type, summary').eq('org_id', orgId).gte('ingested_at', start).lte('ingested_at', end).not('relevance_score', 'is', null).order('relevance_score', { ascending: false }).limit(15);

  const newsText = (news || []).map((n: any) => `- [${n.source_type}] ${n.title}: ${(n.summary || '').substring(0, 100)}`).join('\n');

  const result = await callClaude(
    `Generate a monthly intelligence summary for ${org?.name}. Professional tone, markdown format.`,
    `Period: ${monthStr}\nConversations: ${convCount || 0}\nTop news:\n${newsText || 'None'}\n\nGenerate: # Monthly Summary, ## Executive Summary, ## Key Developments, ## Looking Ahead`,
    4096
  );

  await logApiUsage(orgId, 'monthly_summary', 'claude-sonnet-4-20250514', result.inputTokens, result.outputTokens);
  await supabase.from('intel_monthly_summaries').insert({ org_id: orgId, month: monthStr, content: result.text, generated_by: 'system' });
  log('monthly', `${org?.name}: generated for ${monthStr}`);
}

async function main() {
  log('monthly', 'Starting monthly summary generation');
  for (const org of await getAllActiveOrgs()) await generateForOrg(org.id);
  log('monthly', 'Done');
}

main().catch(err => { log('monthly', `Fatal: ${err}`); process.exit(1); });
