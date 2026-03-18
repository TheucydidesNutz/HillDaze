import { supabaseAdmin } from '@/lib/supabase';
import type { ExtractedStakeholder } from './types';

export async function upsertStakeholders(
  orgId: string,
  stakeholders: ExtractedStakeholder[],
  sourceNewsItemId: string
): Promise<number> {
  let updated = 0;

  for (const person of stakeholders) {
    if (!person.name) continue;

    const { data: existing } = await supabaseAdmin
      .from('intel_stakeholders')
      .select('id, mention_count, mention_sources')
      .eq('org_id', orgId)
      .eq('name', person.name)
      .limit(1)
      .single();

    if (existing) {
      const sources = [...(existing.mention_sources || []), sourceNewsItemId];
      await supabaseAdmin
        .from('intel_stakeholders')
        .update({
          mention_count: existing.mention_count + 1,
          last_mentioned_at: new Date().toISOString(),
          mention_sources: sources.slice(-50),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      updated++;
    } else {
      const { error } = await supabaseAdmin.from('intel_stakeholders').insert({
        org_id: orgId,
        name: person.name,
        title: person.title,
        organization: person.organization,
        role_type: person.role_type,
        relevance_summary: person.context,
        mention_count: 1,
        last_mentioned_at: new Date().toISOString(),
        mention_sources: [sourceNewsItemId],
      });
      if (!error) updated++;
    }
  }

  return updated;
}
