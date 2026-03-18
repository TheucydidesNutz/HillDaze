import { supabase, log, getAllActiveOrgs } from './worker-utils';

async function ingestForOrg(orgId: string): Promise<number> {
  const { data: config } = await supabase.from('intel_api_source_config').select('*').eq('org_id', orgId).eq('source_type', 'regulations_gov').eq('active', true).limit(1).single();
  if (!config || !config.api_key) return 0;

  const searchTerms: string[] = config.search_terms || [];
  const lastFetched = config.last_fetched_at ? new Date(config.last_fetched_at).toISOString().split('T')[0] : new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];

  let added = 0;
  try {
    const params = new URLSearchParams({ 'filter[searchTerm]': searchTerms.join(' '), 'filter[postedDate][ge]': lastFetched, sort: '-postedDate', 'page[size]': '50', api_key: config.api_key });
    const res = await fetch(`https://api.regulations.gov/v4/documents?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return 0;
    const data = await res.json();
    for (const doc of (data.data || [])) {
      const attrs = doc.attributes || {};
      const sourceUrl = attrs.objectId ? `https://www.regulations.gov/document/${attrs.objectId}` : doc.links?.self || '';
      if (!sourceUrl) continue;
      const { data: existing } = await supabase.from('intel_news_items').select('id').eq('org_id', orgId).eq('source_url', sourceUrl).limit(1).single();
      if (existing) continue;
      await supabase.from('intel_news_items').insert({
        org_id: orgId, source_type: 'regulations_gov', source_url: sourceUrl,
        title: attrs.title || 'Untitled',
        raw_content: [attrs.title, attrs.abstract || '', attrs.commentEndDate ? `Comments due: ${attrs.commentEndDate}` : ''].filter(Boolean).join('\n\n'),
      });
      added++;
    }
    await supabase.from('intel_api_source_config').update({ last_fetched_at: new Date().toISOString() }).eq('id', config.id);
  } catch (err) { log('regs', `Error: ${err}`); }
  return added;
}

async function main() {
  log('regs', 'Starting Regulations.gov ingestion');
  for (const org of await getAllActiveOrgs()) {
    const count = await ingestForOrg(org.id);
    log('regs', `${org.name}: ${count} items`);
  }
  log('regs', 'Done');
}

main().catch(err => { log('regs', `Fatal: ${err}`); process.exit(1); });
