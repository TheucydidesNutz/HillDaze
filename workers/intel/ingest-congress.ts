import { supabase, log, getAllActiveOrgs } from './worker-utils';

async function ingestForOrg(orgId: string): Promise<number> {
  const { data: config } = await supabase.from('intel_api_source_config').select('*').eq('org_id', orgId).eq('source_type', 'congress_gov').eq('active', true).limit(1).single();
  if (!config || !config.api_key) return 0;

  const searchTerms: string[] = config.search_terms || [];
  const lastFetched = config.last_fetched_at ? new Date(config.last_fetched_at).toISOString() : new Date(Date.now() - 7 * 864e5).toISOString();

  let added = 0;
  try {
    const params = new URLSearchParams({ query: searchTerms.join(' '), fromDateTime: lastFetched, sort: 'updateDate+desc', limit: '50', api_key: config.api_key });
    const res = await fetch(`https://api.congress.gov/v3/bill?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return 0;
    const data = await res.json();
    for (const bill of (data.bills || [])) {
      const sourceUrl = bill.url || `https://www.congress.gov/bill/${bill.congress}/${bill.type?.toLowerCase()}/${bill.number}`;
      const { data: existing } = await supabase.from('intel_news_items').select('id').eq('org_id', orgId).eq('source_url', sourceUrl).limit(1).single();
      if (existing) continue;
      await supabase.from('intel_news_items').insert({
        org_id: orgId, source_type: 'congress', source_url: sourceUrl,
        title: `${bill.type || ''}${bill.number || ''}: ${bill.title || 'Untitled'}`,
        raw_content: [bill.title, bill.latestAction?.text ? `Latest Action: ${bill.latestAction.text}` : ''].filter(Boolean).join('\n\n'),
      });
      added++;
    }
    await supabase.from('intel_api_source_config').update({ last_fetched_at: new Date().toISOString() }).eq('id', config.id);
  } catch (err) { log('congress', `Error: ${err}`); }
  return added;
}

async function main() {
  log('congress', 'Starting Congress.gov ingestion');
  for (const org of await getAllActiveOrgs()) {
    const count = await ingestForOrg(org.id);
    log('congress', `${org.name}: ${count} items`);
  }
  log('congress', 'Done');
}

main().catch(err => { log('congress', `Fatal: ${err}`); process.exit(1); });
