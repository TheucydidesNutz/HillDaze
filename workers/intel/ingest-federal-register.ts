import { supabase, log, getAllActiveOrgs } from './worker-utils';

async function ingestForOrg(orgId: string): Promise<number> {
  const { data: config } = await supabase.from('intel_api_source_config').select('*').eq('org_id', orgId).eq('source_type', 'federal_register').eq('active', true).limit(1).single();
  if (!config) return 0;

  const searchTerms: string[] = config.search_terms || [];
  const filters = (config.filters || {}) as any;
  const lastFetched = config.last_fetched_at ? new Date(config.last_fetched_at).toISOString().split('T')[0] : new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];

  const params = new URLSearchParams();
  if (searchTerms.length) params.set('conditions[term]', searchTerms.join(' OR '));
  if (filters.document_types) for (const dt of filters.document_types) params.append('conditions[type][]', dt);
  if (filters.agencies) for (const ag of filters.agencies) params.append('conditions[agencies][]', ag);
  params.set('conditions[publication_date][gte]', lastFetched);
  params.set('per_page', '50');
  params.set('order', 'newest');

  let added = 0;
  try {
    const res = await fetch(`https://www.federalregister.gov/api/v1/documents.json?${params}`);
    if (!res.ok) return 0;
    const data = await res.json();
    for (const doc of (data.results || [])) {
      const sourceUrl = doc.html_url || '';
      if (!sourceUrl) continue;
      const { data: existing } = await supabase.from('intel_news_items').select('id').eq('org_id', orgId).eq('source_url', sourceUrl).limit(1).single();
      if (existing) continue;
      await supabase.from('intel_news_items').insert({
        org_id: orgId, source_type: 'federal_register', source_url: sourceUrl,
        title: doc.title || 'Untitled',
        raw_content: [doc.abstract, doc.action ? `Action: ${doc.action}` : '', doc.dates ? `Dates: ${doc.dates}` : ''].filter(Boolean).join('\n\n'),
      });
      added++;
    }
    await supabase.from('intel_api_source_config').update({ last_fetched_at: new Date().toISOString() }).eq('id', config.id);
  } catch (err) { log('fed-reg', `Error: ${err}`); }
  return added;
}

async function main() {
  log('fed-reg', 'Starting Federal Register ingestion');
  for (const org of await getAllActiveOrgs()) {
    const count = await ingestForOrg(org.id);
    log('fed-reg', `${org.name}: ${count} items`);
  }
  log('fed-reg', 'Done');
}

main().catch(err => { log('fed-reg', `Fatal: ${err}`); process.exit(1); });
