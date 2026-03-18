import { supabaseAdmin } from '@/lib/supabase';

function getMonthRange(month: Date): [string, string] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

function getQuarterRange(month: Date): [string, string] {
  const q = Math.floor(month.getMonth() / 3);
  const start = new Date(month.getFullYear(), q * 3, 1);
  const end = new Date(month.getFullYear(), q * 3 + 3, 0);
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safe(query: PromiseLike<{ data: any }>): Promise<any[]> {
  try { return (await query).data || []; } catch { return []; }
}

export async function gatherMonthlyData(orgId: string, month: Date) {
  const [start, end] = getMonthRange(month);
  return gatherDataForRange(orgId, start, end);
}

export async function gatherQuarterlyData(orgId: string, month: Date) {
  const [start, end] = getQuarterRange(month);
  return gatherDataForRange(orgId, start, end);
}

async function gatherDataForRange(orgId: string, start: string, end: string) {
  const nextMonth = new Date(end);
  nextMonth.setDate(nextMonth.getDate() + 1);
  const nextMonthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);

  const [
    recommendations, trends, focusProposals, strategicRecs,
    documents, topNews, soulDocVersions, conversations,
    calendarEvents, stakeholders, researchTargets, memories,
  ] = await Promise.all([
    safe(supabaseAdmin.from('intel_article_recommendations').select('*').eq('org_id', orgId).gte('created_at', start).lte('created_at', end + 'T23:59:59Z')),
    safe(supabaseAdmin.from('intel_trend_reports').select('*').eq('org_id', orgId).gte('created_at', start).lte('created_at', end + 'T23:59:59Z')),
    safe(supabaseAdmin.from('intel_focus_proposals').select('*').eq('org_id', orgId).gte('created_at', start).lte('created_at', end + 'T23:59:59Z')),
    safe(supabaseAdmin.from('intel_strategic_recommendations').select('*').eq('org_id', orgId).gte('created_at', start).lte('created_at', end + 'T23:59:59Z')),
    safe(supabaseAdmin.from('intel_documents').select('*').eq('org_id', orgId).gte('uploaded_at', start).lte('uploaded_at', end + 'T23:59:59Z')),
    safe(supabaseAdmin.from('intel_news_items').select('*').eq('org_id', orgId).gte('ingested_at', start).lte('ingested_at', end + 'T23:59:59Z').not('relevance_score', 'is', null).order('relevance_score', { ascending: false }).limit(20)),
    safe(supabaseAdmin.from('intel_soul_documents').select('*').eq('org_id', orgId).gte('updated_at', start).lte('updated_at', end + 'T23:59:59Z')),
    safe(supabaseAdmin.from('intel_conversations').select('id').eq('org_id', orgId).gte('created_at', start).lte('created_at', end + 'T23:59:59Z')),
    safe(supabaseAdmin.from('intel_calendar_events').select('*').eq('org_id', orgId).gte('event_date', nextMonth.toISOString().split('T')[0]).lte('event_date', nextMonthEnd.toISOString().split('T')[0]).order('event_date', { ascending: true })),
    safe(supabaseAdmin.from('intel_stakeholders').select('*').eq('org_id', orgId).order('mention_count', { ascending: false }).limit(15)),
    safe(supabaseAdmin.from('intel_research_targets').select('*, intel_research_target_summaries(content, version, generated_at)').eq('org_id', orgId).eq('status', 'active')),
    safe(supabaseAdmin.from('intel_agent_memory').select('*').eq('org_id', orgId).gte('last_seen_at', start).lte('last_seen_at', end + 'T23:59:59Z').eq('status', 'active')),
  ]);

  return {
    period: { start, end },
    recommendations, trends, focusProposals, strategicRecs,
    documents, topNews, soulDocVersions,
    conversationCount: conversations.length,
    calendarEvents, stakeholders, researchTargets, memories,
  };
}
