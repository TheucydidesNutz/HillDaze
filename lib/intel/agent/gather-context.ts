import { supabaseAdmin } from '@/lib/supabase';
import { getOrgById, getLatestSoulDocument, getDocuments } from '../supabase-queries';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery(query: PromiseLike<{ data: any[] | null }>): Promise<any[]> {
  try {
    const result = await query;
    return result.data || [];
  } catch {
    return [];
  }
}

export async function gatherGenerationContext(orgId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [org, soulDoc, documents] = await Promise.all([
    getOrgById(orgId),
    getLatestSoulDocument(orgId),
    getDocuments(orgId),
  ]);

  const [memories, newsItems, stakeholders, calendarEvents, recommendations] = await Promise.all([
    safeQuery(supabaseAdmin.from('intel_agent_memory').select('*').eq('org_id', orgId).eq('status', 'active').order('mention_count', { ascending: false }).limit(15)),
    safeQuery(supabaseAdmin.from('intel_news_items').select('*').eq('org_id', orgId).order('ingested_at', { ascending: false }).limit(30)),
    safeQuery(supabaseAdmin.from('intel_stakeholders').select('*').eq('org_id', orgId).order('mention_count', { ascending: false }).limit(20)),
    safeQuery(supabaseAdmin.from('intel_calendar_events').select('*').eq('org_id', orgId).gte('event_date', now.toISOString().split('T')[0]).lte('event_date', thirtyDaysFromNow.toISOString().split('T')[0]).order('event_date', { ascending: true }).limit(15)),
    safeQuery(supabaseAdmin.from('intel_article_recommendations').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(10)),
  ]);

  const orgName = org?.name || 'this organization';
  const soulDocContent = soulDoc?.content || 'No soul document created yet.';

  const docSummaries = documents.slice(0, 20).map(d =>
    `- "${d.summary_metadata?.title || d.filename}": ${(d.summary || '').substring(0, 150)}`
  ).join('\n') || 'No documents uploaded yet.';

  const memoriesText = memories.map(m =>
    `- [${m.memory_type}] ${m.subject}: ${m.content}`
  ).join('\n') || 'No observations accumulated yet.';

  const newsText = newsItems.map(n => {
    const score = n.relevance_score != null ? ` (relevance: ${Number(n.relevance_score).toFixed(1)})` : '';
    return `- [${n.source_type}] "${n.title}"${score}: ${(n.summary || n.raw_content || '').substring(0, 200)}`;
  }).join('\n') || 'No recent news items.';

  const stakeholderText = stakeholders.map(s =>
    `- ${s.name} (${s.title || s.role_type}, ${s.organization || 'Unknown'}) — Mentions: ${s.mention_count}${s.stance ? ', Stance: ' + s.stance : ''}`
  ).join('\n') || 'No stakeholders identified yet.';

  const calendarText = calendarEvents.map(e => {
    const days = Math.ceil((new Date(e.event_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `- [${days} days] ${e.title} (${e.event_type}) — ${e.event_date}${e.action_needed ? ': ' + e.action_needed : ''}`;
  }).join('\n') || 'No upcoming deadlines.';

  const recsText = recommendations.map(r =>
    `- "${r.title}" (${r.article_type}, status: ${r.status})`
  ).join('\n') || 'No existing recommendations.';

  return {
    org, orgName, soulDocContent, docSummaries,
    memoriesText, newsText, stakeholderText, calendarText, recsText,
    rawStakeholders: stakeholders,
  };
}
