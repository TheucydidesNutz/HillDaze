import { supabaseAdmin } from '@/lib/supabase';

export async function ingestRegulationsForOrg(orgId: string): Promise<number> {
  const { data: config } = await supabaseAdmin
    .from('intel_api_source_config')
    .select('*')
    .eq('org_id', orgId)
    .eq('source_type', 'regulations_gov')
    .eq('active', true)
    .limit(1)
    .single();

  if (!config || !config.api_key) return 0;

  const searchTerms: string[] = config.search_terms || [];
  const lastFetched = config.last_fetched_at
    ? new Date(config.last_fetched_at).toISOString().split('T')[0]
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const params = new URLSearchParams({
    'filter[searchTerm]': searchTerms.join(' '),
    'filter[postedDate][ge]': lastFetched,
    'sort': '-postedDate',
    'page[size]': '50',
    'api_key': config.api_key,
  });

  const url = `https://api.regulations.gov/v4/documents?${params.toString()}`;

  let itemsAdded = 0;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error('Regulations.gov API error:', res.status);
      return 0;
    }

    const data = await res.json();
    const docs = data.data || [];

    for (const doc of docs) {
      const attrs = doc.attributes || {};
      const sourceUrl = attrs.objectId
        ? `https://www.regulations.gov/document/${attrs.objectId}`
        : doc.links?.self || '';

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
        attrs.title,
        attrs.abstract || attrs.summary || '',
        attrs.agencyId ? `Agency: ${attrs.agencyId}` : '',
        attrs.commentEndDate ? `Comments due: ${attrs.commentEndDate}` : '',
      ].filter(Boolean).join('\n\n');

      await supabaseAdmin.from('intel_news_items').insert({
        org_id: orgId,
        source_type: 'regulations_gov',
        source_url: sourceUrl,
        title: attrs.title || 'Untitled',
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
    console.error('Regulations.gov ingestion error:', err);
  }

  return itemsAdded;
}
