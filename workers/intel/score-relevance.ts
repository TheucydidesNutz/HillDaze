import { supabase, callClaude, logApiUsage, log, getAllActiveOrgs } from './worker-utils';

async function scoreForOrg(orgId: string) {
  const { data: soulDoc } = await supabase.from('intel_soul_documents').select('content').eq('org_id', orgId).order('version', { ascending: false }).limit(1).single();
  const focusAreas = soulDoc?.content?.substring(0, 1000) || 'No focus areas.';
  const { data: org } = await supabase.from('intel_organizations').select('name').eq('id', orgId).single();

  const { data: unscoredItems } = await supabase.from('intel_news_items').select('*').eq('org_id', orgId).is('relevance_score', null).limit(50);
  if (!unscoredItems?.length) { log('score', `${org?.name}: no unscored items`); return; }

  for (let i = 0; i < unscoredItems.length; i += 10) {
    const batch = unscoredItems.slice(i, i + 10);
    const itemsText = batch.map((item: any) => `ID: ${item.id}\nTitle: ${item.title}\nContent: ${(item.raw_content || '').substring(0, 500)}`).join('\n\n---\n\n');

    try {
      const result = await callClaude(
        `You are a relevance assessor for ${org?.name}. Focus areas: ${focusAreas}\n\nReturn ONLY valid JSON: {"scored_items":[{"id":"...","relevance_score":0.0-1.0,"summary":"...","calendar_events":[{"title":"...","event_type":"...","date":"YYYY-MM-DD","end_date":null,"description":"...","action_needed":"..."}],"stakeholders":[{"name":"...","title":"...","organization":"...","role_type":"...","context":"..."}]}]}`,
        `Score these:\n\n${itemsText}`
      );

      await logApiUsage(orgId, 'relevance_scoring', 'claude-sonnet-4-20250514', result.inputTokens, result.outputTokens);

      const parsed = JSON.parse(result.text);
      for (const scored of (parsed.scored_items || [])) {
        await supabase.from('intel_news_items').update({ relevance_score: scored.relevance_score, summary: scored.summary }).eq('id', scored.id);

        // Calendar events
        for (const evt of (scored.calendar_events || [])) {
          if (!evt.date) continue;
          const { data: existing } = await supabase.from('intel_calendar_events').select('id').eq('org_id', orgId).eq('event_date', evt.date).ilike('title', `%${evt.title.substring(0, 30)}%`).limit(1).single();
          if (!existing) {
            await supabase.from('intel_calendar_events').insert({ org_id: orgId, title: evt.title, event_type: evt.event_type, event_date: evt.date, end_date: evt.end_date, description: evt.description, source_type: 'agent_extracted', source_ref: { news_item_id: scored.id }, action_needed: evt.action_needed });
          }
        }

        // Stakeholders
        for (const person of (scored.stakeholders || [])) {
          if (!person.name) continue;
          const { data: existing } = await supabase.from('intel_stakeholders').select('id, mention_count, mention_sources').eq('org_id', orgId).eq('name', person.name).limit(1).single();
          if (existing) {
            await supabase.from('intel_stakeholders').update({ mention_count: existing.mention_count + 1, last_mentioned_at: new Date().toISOString(), mention_sources: [...(existing.mention_sources || []).slice(-49), scored.id] }).eq('id', existing.id);
          } else {
            await supabase.from('intel_stakeholders').insert({ org_id: orgId, name: person.name, title: person.title, organization: person.organization, role_type: person.role_type, relevance_summary: person.context, mention_count: 1, last_mentioned_at: new Date().toISOString(), mention_sources: [scored.id] });
          }
        }
      }
    } catch (err) { log('score', `Batch error: ${err}`); }
  }

  // Research target matching
  const { data: targets } = await supabase.from('intel_research_targets').select('id, search_terms').eq('org_id', orgId).eq('status', 'active');
  if (targets?.length) {
    for (const item of unscoredItems) {
      const text = `${item.title} ${item.summary || item.raw_content || ''}`.toLowerCase();
      for (const target of targets) {
        if ((target.search_terms || []).some((t: string) => text.includes(t.toLowerCase()))) {
          const { data: existing } = await supabase.from('intel_research_target_news').select('id').eq('target_id', target.id).eq('news_item_id', item.id).limit(1).single();
          if (!existing) await supabase.from('intel_research_target_news').insert({ target_id: target.id, news_item_id: item.id });
        }
      }
    }
  }

  log('score', `${org?.name}: scored ${unscoredItems.length} items`);
}

async function main() {
  log('score', 'Starting relevance scoring');
  for (const org of await getAllActiveOrgs()) await scoreForOrg(org.id);
  log('score', 'Done');
}

main().catch(err => { log('score', `Fatal: ${err}`); process.exit(1); });
