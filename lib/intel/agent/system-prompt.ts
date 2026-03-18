import { supabaseAdmin } from '@/lib/supabase';
import { getOrgById, getLatestSoulDocument, getDocuments, getUserOrgMembership } from '../supabase-queries';

export async function buildSystemPrompt(orgId: string, userId: string): Promise<string> {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [org, soulDoc, documents, member] = await Promise.all([
    getOrgById(orgId),
    getLatestSoulDocument(orgId),
    getDocuments(orgId),
    getUserOrgMembership(orgId, userId),
  ]);

  // Fetch optional context — these tables may not exist yet, so handle errors gracefully
  async function safeQuery(query: PromiseLike<{ data: unknown[] | null }>): Promise<unknown[] | null> {
    try {
      const result = await query;
      return result.data;
    } catch {
      return null;
    }
  }

  const [memoriesResult, calendarResult, stakeholdersResult, newsResult, researchResult] = await Promise.all([
    safeQuery(supabaseAdmin.from('intel_agent_memory').select('*').eq('org_id', orgId).eq('status', 'active').order('last_seen_at', { ascending: false }).limit(20)),
    safeQuery(supabaseAdmin.from('intel_calendar_events').select('*').eq('org_id', orgId).gte('event_date', now.toISOString().split('T')[0]).lte('event_date', thirtyDays.toISOString().split('T')[0]).order('event_date', { ascending: true }).limit(10)),
    safeQuery(supabaseAdmin.from('intel_stakeholders').select('*').eq('org_id', orgId).order('influence_score', { ascending: false }).limit(15)),
    safeQuery(supabaseAdmin.from('intel_news_items').select('*').eq('org_id', orgId).not('relevance_score', 'is', null).gte('relevance_score', 0.5).order('relevance_score', { ascending: false }).limit(20)),
    safeQuery(supabaseAdmin.from('intel_research_targets').select('name, description, intel_research_target_summaries(content, generated_at)').eq('org_id', orgId).eq('status', 'active')),
  ]);

  // Organize documents by folder structure
  let docList: string;
  let truncationNote = '';

  // Try to get folder structure
  let folders: { id: string; parent_id: string | null; name: string; folder_type: string }[] = [];
  try {
    const { data: folderData } = await supabaseAdmin
      .from('intel_document_folders')
      .select('id, parent_id, name, folder_type')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true });
    folders = folderData || [];
  } catch {
    // Table may not exist yet
  }

  if (folders.length > 0) {
    const docsSliced = documents.slice(0, 30);
    const folderMap = new Map(folders.map(f => [f.id, f]));
    const lines: string[] = [];

    // Build folder paths
    function getFolderPath(folderId: string): string {
      const parts: string[] = [];
      let current = folderMap.get(folderId);
      while (current) {
        parts.unshift(current.name);
        current = current.parent_id ? folderMap.get(current.parent_id) : undefined;
      }
      return parts.join('/');
    }

    // Group documents by folder
    const grouped = new Map<string, typeof docsSliced>();
    const ungrouped: typeof docsSliced = [];
    for (const d of docsSliced) {
      const fid = (d as unknown as Record<string, unknown>).folder_id as string | undefined;
      if (fid) {
        if (!grouped.has(fid)) grouped.set(fid, []);
        grouped.get(fid)!.push(d);
      } else {
        ungrouped.push(d);
      }
    }

    for (const [fid, docs] of grouped) {
      const path = getFolderPath(fid);
      lines.push(`${path}/`);
      for (const d of docs) {
        lines.push(`  - "${d.summary_metadata?.title || d.filename}": ${(d.summary || '').substring(0, 200)}`);
      }
    }

    if (ungrouped.length > 0) {
      lines.push('Uncategorized/');
      for (const d of ungrouped) {
        lines.push(`  - "${d.summary_metadata?.title || d.filename}": ${(d.summary || '').substring(0, 200)}`);
      }
    }

    docList = lines.join('\n');
    if (documents.length > 30) {
      truncationNote = '\n(Showing 30 most recent documents. Ask me to search for specific topics.)';
    }
  } else {
    docList = documents
      .slice(0, 30)
      .map(d =>
        `[${d.folder}] "${d.summary_metadata?.title || d.filename}": ${(d.summary || '').substring(0, 200)}`
      )
      .join('\n');

    if (documents.length > 30) {
      truncationNote = '\n(Showing 30 most recent documents. Ask me to search for specific topics.)';
    }
  }

  // If no scored news items, fall back to most recent unscored items
  let finalNewsResult = newsResult;
  if (!finalNewsResult || finalNewsResult.length === 0) {
    finalNewsResult = await safeQuery(
      supabaseAdmin.from('intel_news_items').select('*').eq('org_id', orgId).order('ingested_at', { ascending: false }).limit(20)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memories = (memoriesResult || []) as any[];
  const calendarEvents = (calendarResult || []) as any[];
  const stakeholders = (stakeholdersResult || []) as any[];
  const newsItems = (finalNewsResult || []) as any[];
  const researchTargets = (researchResult || []) as any[];

  const memorySection = memories.length
    ? `\n═══ PERSISTENT MEMORY ═══

These are observations and patterns I have accumulated across conversations:

${memories.map(m =>
  `- [${m.memory_type}] ${m.subject}: ${m.content} (noted ${m.mention_count}x)`
).join('\n')}\n`
    : '';

  const calendarSection = calendarEvents.length
    ? `\n═══ UPCOMING DEADLINES ═══

${calendarEvents.map(e => {
  const days = Math.ceil((new Date(e.event_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return `- [${days} days] ${e.title} (${e.event_type}) — ${e.event_date}${e.action_needed ? ': ' + e.action_needed : ''}`;
}).join('\n')}\n`
    : '';

  const stakeholderSection = stakeholders.length
    ? `\n═══ KEY STAKEHOLDERS ═══

${stakeholders.map(s =>
  `- ${s.name} (${s.title || s.role_type}, ${s.organization || 'Unknown org'}) — Influence: ${s.influence_score}/1.0${s.stance ? ' — Stance: ' + s.stance : ''}`
).join('\n')}\n`
    : '';

  const newsSection = newsItems.length
    ? `\n═══ RECENT DEVELOPMENTS ═══

The following items were recently ingested from news feeds and government sources. Reference these when discussing current events and recent developments.

${newsItems.map(n => {
  const score = n.relevance_score != null ? ` (relevance: ${Number(n.relevance_score).toFixed(1)})` : '';
  const content = n.summary || (n.raw_content ? n.raw_content.substring(0, 200) : '');
  return `- [${n.source_type}] "${n.title}"${score}: ${content}`;
}).join('\n')}\n`
    : '';

  const researchSection = researchTargets.length
    ? `\n═══ RESEARCH TARGETS ═══

The organization is actively tracking these research topics:

${researchTargets.map(t => {
  const summaries = t.intel_research_target_summaries || [];
  const latest = summaries[0];
  return `### ${t.name}\n${t.description}\n${latest?.content ? latest.content.substring(0, 500) + '...' : 'No summary generated yet.'}`;
}).join('\n\n')}\n`
    : '';

  return `You are the Intelligence Analyst for ${org?.name || 'this organization'}.

═══ ROLE & CONSTRAINTS ═══

You are an advisory research and strategy analyst embedded within a trade group consultancy. Your role is to analyze policy, regulatory, and industry developments relevant to the organization, and provide actionable intelligence.

CRITICAL CONSTRAINTS:
1. You are ADVISORY ONLY. You never send emails, post to social media, file comments, or take any autonomous external action. Everything you produce is a draft for human review.
2. Always frame outputs as "draft for review", "recommendation for consideration", or "suggested approach".
3. Never produce content that could be construed as legal advice, lobbying disclosure language, or official government submissions.
4. Never disclose the existence of user reliability scoring, user activity tracking, or the reliability dashboard.
5. When citing sources, reference specific documents by title using [Source: document_name] format.
6. Strip personal contact information from any content you include in responses.
7. You only know about and reference data from THIS organization.

═══ ORGANIZATION CONSTITUTION ═══

${soulDoc?.content || 'No soul document has been created yet.'}

═══ DOCUMENT LIBRARY ═══

The following documents are in the organization's library. You can reference these in your responses. For deep-dive documents, the user can ask you to perform detailed analysis.

${docList || 'No documents uploaded yet.'}${truncationNote}
${memorySection}${newsSection}${calendarSection}${stakeholderSection}${researchSection}
═══ CURRENT USER ═══

You are speaking with: ${member?.display_name || 'Unknown User'}
Title: ${member?.title || 'N/A'}
Role: ${member?.role || 'user'}

═══ OUTPUT GUIDELINES ═══

- Use the organization's voice and tone as defined in the constitution
- Be direct, analytical, and actionable
- When discussing policy, cite specific bills, regulations, or agency actions where available
- Format responses in clean markdown: use headers, bold, lists, and tables where appropriate
- For long-form content, use professional structure: executive summary, key points, supporting detail
- If asked about something outside the organization's scope, note it and suggest whether it warrants adding

═══ CONVERSATION MODE ═══

You are in a conversational chat with a team member. Be helpful, concise, and reference relevant documents and news when applicable. If the user asks you to "deep dive" into a document, you will receive the full text — analyze it thoroughly.`;
}
