import { supabaseAdmin } from '@/lib/supabase';

export async function ingestFederalRegisterForOrg(orgId: string): Promise<number> {
  const { data: config } = await supabaseAdmin
    .from('intel_api_source_config')
    .select('*')
    .eq('org_id', orgId)
    .eq('source_type', 'federal_register')
    .eq('active', true)
    .limit(1)
    .single();

  if (!config) return 0;

  const searchTerms: string[] = config.search_terms || [];
  const filters = (config.filters || {}) as { document_types?: string[]; agencies?: string[] };
  const lastFetched = config.last_fetched_at
    ? new Date(config.last_fetched_at).toISOString().split('T')[0]
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const params = new URLSearchParams();
  if (searchTerms.length > 0) params.set('conditions[term]', searchTerms.join(' OR '));
  if (filters.document_types) {
    for (const dt of filters.document_types) params.append('conditions[type][]', dt);
  }
  if (filters.agencies) {
    for (const ag of filters.agencies) params.append('conditions[agencies][]', ag);
  }
  params.set('conditions[publication_date][gte]', lastFetched);
  params.set('per_page', '50');
  params.set('order', 'newest');

  const url = `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`;

  let itemsAdded = 0;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Federal Register API error:', res.status);
      return 0;
    }

    const data = await res.json();
    const results = data.results || [];

    for (const doc of results) {
      const sourceUrl = doc.html_url || doc.pdf_url || '';
      if (!sourceUrl) continue;

      const { data: existing } = await supabaseAdmin
        .from('intel_news_items')
        .select('id')
        .eq('org_id', orgId)
        .eq('source_url', sourceUrl)
        .limit(1)
        .single();

      if (existing) continue;

      const rawContent = [
        doc.abstract,
        doc.action ? `Action: ${doc.action}` : '',
        doc.dates ? `Dates: ${doc.dates}` : '',
        doc.agencies?.map((a: { name: string }) => a.name).join(', '),
      ].filter(Boolean).join('\n\n');

      await supabaseAdmin.from('intel_news_items').insert({
        org_id: orgId,
        source_type: 'federal_register',
        source_url: sourceUrl,
        title: doc.title || 'Untitled',
        raw_content: rawContent || null,
        summary: null,
        relevance_score: null,
      });
      itemsAdded++;
    }

    await supabaseAdmin
      .from('intel_api_source_config')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', config.id);
  } catch (err) {
    console.error('Federal Register ingestion error:', err);
  }

  return itemsAdded;
}
