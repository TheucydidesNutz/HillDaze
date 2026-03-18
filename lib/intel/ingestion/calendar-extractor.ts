import { supabaseAdmin } from '@/lib/supabase';
import type { ExtractedCalendarEvent } from './types';

export async function upsertCalendarEvents(
  orgId: string,
  events: ExtractedCalendarEvent[],
  sourceNewsItemId: string
): Promise<number> {
  let created = 0;

  for (const event of events) {
    if (!event.date) continue;

    const { data: existing } = await supabaseAdmin
      .from('intel_calendar_events')
      .select('id')
      .eq('org_id', orgId)
      .eq('event_date', event.date)
      .ilike('title', `%${event.title.substring(0, 30)}%`)
      .limit(1)
      .single();

    if (!existing) {
      const { error } = await supabaseAdmin.from('intel_calendar_events').insert({
        org_id: orgId,
        title: event.title,
        event_type: event.event_type,
        event_date: event.date,
        end_date: event.end_date,
        description: event.description,
        source_type: 'agent_extracted',
        source_ref: { news_item_id: sourceNewsItemId },
        relevance_score: event.relevance_score || 0.7,
        action_needed: event.action_needed,
      });
      if (!error) created++;
    }
  }

  return created;
}
