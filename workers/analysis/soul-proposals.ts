import { supabase, getAnthropic, log, logApiUsage } from './worker-utils';

const WORKER = 'analysis-soul-proposals';

async function main() {
  log(WORKER, 'Checking for profiles needing soul document updates...');

  // Get all soul documents with their profiles
  const { data: soulDocs } = await supabase
    .from('analysis_soul_documents')
    .select('id, profile_id, org_id, content, last_regenerated_at, profile:analysis_profiles(full_name)');

  if (!soulDocs || soulDocs.length === 0) {
    log(WORKER, 'No soul documents found');
    return;
  }

  for (const doc of soulDocs) {
    const profile = doc.profile as { full_name: string } | null;
    if (!profile) continue;

    // Check for new data items since last regeneration
    let query = supabase
      .from('analysis_data_items')
      .select('id, category, title, summary, key_quotes, key_topics, item_date')
      .eq('profile_id', doc.profile_id)
      .eq('verification_status', 'verified')
      .order('created_at', { ascending: false })
      .limit(50);

    if (doc.last_regenerated_at) {
      query = query.gt('created_at', doc.last_regenerated_at);
    }

    const { data: newItems } = await query;

    if (!newItems || newItems.length === 0) continue;

    log(WORKER, `${profile.full_name}: ${newItems.length} new items since last update`);

    // Check for existing pending proposals
    const { count } = await supabase
      .from('analysis_soul_document_proposals')
      .select('id', { count: 'exact', head: true })
      .eq('soul_document_id', doc.id)
      .eq('status', 'pending');

    if ((count || 0) >= 5) {
      log(WORKER, `  Skipping — already ${count} pending proposals`);
      continue;
    }

    // Ask Claude what should be updated
    const itemSummaries = newItems.map(i =>
      `[${i.id}] (${i.category}, ${i.item_date || 'undated'}) ${i.title}: ${(i.summary || '').substring(0, 200)}`
    ).join('\n');

    try {
      const client = getAnthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You analyze new data about a public figure and propose updates to their soul document. Return ONLY valid JSON.',
        messages: [{
          role: 'user',
          content: `Current soul document for ${profile.full_name}:
${JSON.stringify(doc.content, null, 1).substring(0, 3000)}

New data items:
${itemSummaries}

Propose updates. Return a JSON array of proposals:
[{
  "section": "which soul document section to update (e.g. priorities, communication_style)",
  "proposed_changes": { ... partial JSON to merge into that section ... },
  "reasoning": "why this update is warranted based on the new data",
  "source_data_item_ids": ["item-id-1", "item-id-2"]
}]

Only propose updates that are clearly supported by the data. Return [] if no updates are warranted.`,
        }],
      });

      await logApiUsage(doc.org_id, 'analysis_soul_proposals', 'claude-sonnet-4-20250514', response.usage.input_tokens, response.usage.output_tokens);

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') continue;

      let proposals: Array<{ section: string; proposed_changes: Record<string, unknown>; reasoning: string; source_data_item_ids: string[] }> = [];
      try {
        let t = textBlock.text.trim();
        if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        proposals = JSON.parse(t);
      } catch { continue; }

      if (!Array.isArray(proposals)) continue;

      for (const p of proposals) {
        await supabase.from('analysis_soul_document_proposals').insert({
          soul_document_id: doc.id,
          org_id: doc.org_id,
          proposed_changes: { [p.section]: p.proposed_changes },
          reasoning: p.reasoning,
          source_data_item_ids: p.source_data_item_ids || [],
          status: 'pending',
        });
      }

      log(WORKER, `  Created ${proposals.length} proposals`);
    } catch (err) {
      log(WORKER, `  Error: ${err}`);
    }
  }

  log(WORKER, 'Soul proposals check complete');
}

main().catch(err => {
  log(WORKER, `Fatal: ${err}`);
  process.exit(1);
});
