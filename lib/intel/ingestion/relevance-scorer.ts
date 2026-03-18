import { supabaseAdmin } from '@/lib/supabase';
import { callClaude } from '../agent/client';
import { logApiUsage } from '../agent/usage';
import { getLatestSoulDocument, getOrgById } from '../supabase-queries';
import { upsertCalendarEvents } from './calendar-extractor';
import { upsertStakeholders } from './stakeholder-extractor';
import type { ScoredItem } from './types';

export async function scoreRelevanceForOrg(orgId: string): Promise<{
  items_scored: number;
  calendar_events_created: number;
  stakeholders_updated: number;
}> {
  const org = await getOrgById(orgId);
  const soulDoc = await getLatestSoulDocument(orgId);
  const focusAreas = soulDoc?.content?.substring(0, 1000) || 'No focus areas defined.';

  // Fetch unscored items
  const { data: unscoredItems } = await supabaseAdmin
    .from('intel_news_items')
    .select('*')
    .eq('org_id', orgId)
    .is('relevance_score', null)
    .limit(50);

  if (!unscoredItems || unscoredItems.length === 0) {
    return { items_scored: 0, calendar_events_created: 0, stakeholders_updated: 0 };
  }

  let totalScored = 0;
  let totalCalendarEvents = 0;
  let totalStakeholders = 0;

  // Process in batches of 10
  for (let i = 0; i < unscoredItems.length; i += 10) {
    const batch = unscoredItems.slice(i, i + 10);

    const itemsText = batch.map((item: { id: string; title: string; raw_content: string | null }) =>
      `ID: ${item.id}\nTitle: ${item.title}\nContent: ${(item.raw_content || '').substring(0, 500)}`
    ).join('\n\n---\n\n');

    try {
      const result = await callClaude({
        system: `You are a relevance assessor for ${org?.name || 'this organization'}.
The organization's focus areas are:
${focusAreas}

For each news item, assess:
1. Relevance score (0.0-1.0) to the organization's mission and priorities
2. A brief summary of why it's relevant (or not)
3. Any time-sensitive dates mentioned (comment deadlines, hearings, votes, effective dates)
4. Any named individuals who are relevant policy actors

Return ONLY valid JSON, no markdown. Format:
{
  "scored_items": [
    {
      "id": "item_id",
      "relevance_score": 0.85,
      "summary": "Brief relevance assessment",
      "calendar_events": [
        {
          "title": "Event title",
          "event_type": "comment_period_close",
          "date": "2026-04-15",
          "end_date": null,
          "description": "Description",
          "action_needed": "Action needed"
        }
      ],
      "stakeholders": [
        {
          "name": "Jane Smith",
          "title": "Administrator",
          "organization": "Agency Name",
          "role_type": "regulator",
          "context": "Context of mention"
        }
      ]
    }
  ]
}`,
        userMessage: `Score these news items for relevance:\n\n${itemsText}`,
        maxTokens: 4096,
      });

      await logApiUsage({
        orgId,
        endpoint: 'relevance_scoring',
        model: 'claude-sonnet-4-20250514',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      let parsed: { scored_items: ScoredItem[] };
      try {
        parsed = JSON.parse(result.text);
      } catch {
        console.error('Failed to parse scoring response');
        continue;
      }

      for (const scored of (parsed.scored_items || [])) {
        // Update the news item
        await supabaseAdmin
          .from('intel_news_items')
          .update({
            relevance_score: scored.relevance_score,
            summary: scored.summary,
          })
          .eq('id', scored.id);
        totalScored++;

        // Extract calendar events
        if (scored.calendar_events?.length) {
          totalCalendarEvents += await upsertCalendarEvents(orgId, scored.calendar_events, scored.id);
        }

        // Extract stakeholders
        if (scored.stakeholders?.length) {
          totalStakeholders += await upsertStakeholders(orgId, scored.stakeholders, scored.id);
        }
      }
    } catch (err) {
      console.error('Scoring batch error:', err);
    }
  }

  // Auto-match scored items to research targets by keyword
  try {
    const { data: targets } = await supabaseAdmin
      .from('intel_research_targets')
      .select('id, search_terms')
      .eq('org_id', orgId)
      .eq('status', 'active');

    if (targets && targets.length > 0) {
      for (const item of unscoredItems) {
        const itemText = `${item.title} ${item.summary || item.raw_content || ''}`.toLowerCase();
        for (const target of targets) {
          const terms = (target.search_terms || []) as string[];
          if (terms.some(t => itemText.includes(t.toLowerCase()))) {
            // Check if already linked
            const { data: existing } = await supabaseAdmin
              .from('intel_research_target_news')
              .select('id')
              .eq('target_id', target.id)
              .eq('news_item_id', item.id)
              .limit(1)
              .single();

            if (!existing) {
              await supabaseAdmin.from('intel_research_target_news').insert({
                target_id: target.id,
                news_item_id: item.id,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Research target matching error:', err);
  }

  return {
    items_scored: totalScored,
    calendar_events_created: totalCalendarEvents,
    stakeholders_updated: totalStakeholders,
  };
}
