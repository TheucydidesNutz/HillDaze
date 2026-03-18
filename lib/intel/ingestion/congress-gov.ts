import { supabaseAdmin } from '@/lib/supabase';

export async function ingestCongressForOrg(orgId: string): Promise<number> {
  const { data: config } = await supabaseAdmin
    .from('intel_api_source_config')
    .select('*')
    .eq('org_id', orgId)
    .eq('source_type', 'congress_gov')
    .eq('active', true)
    .limit(1)
    .single();

  if (!config || !config.api_key) return 0;

  const searchTerms: string[] = config.search_terms || [];
  const lastFetched = config.last_fetched_at
    ? new Date(config.last_fetched_at).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    query: searchTerms.join(' '),
    fromDateTime: lastFetched,
    sort: 'updateDate+desc',
    limit: '50',
    api_key: config.api_key,
  });

  const url = `https://api.congress.gov/v3/bill?${params.toString()}`;

  let itemsAdded = 0;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error('Congress.gov API error:', res.status);
      return 0;
    }

    const data = await res.json();
    const bills = data.bills || [];

    for (const bill of bills) {
      const sourceUrl = bill.url || `https://www.congress.gov/bill/${bill.congress}/${bill.type?.toLowerCase()}/${bill.number}`;

      const { data: existing } = await supabaseAdmin
        .from('intel_news_items')
        .select('id')
        .eq('org_id', orgId)
        .eq('source_url', sourceUrl)
        .limit(1)
        .single();

      if (existing) continue;

      const rawContent = [
        bill.title,
        bill.latestAction?.text ? `Latest Action: ${bill.latestAction.text} (${bill.latestAction.actionDate})` : '',
        bill.policyArea?.name ? `Policy Area: ${bill.policyArea.name}` : '',
      ].filter(Boolean).join('\n\n');

      await supabaseAdmin.from('intel_news_items').insert({
        org_id: orgId,
        source_type: 'congress',
        source_url: sourceUrl,
        title: `${bill.type || ''}${bill.number || ''}: ${bill.title || 'Untitled'}`,
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
    console.error('Congress.gov ingestion error:', err);
  }

  return itemsAdded;
}
