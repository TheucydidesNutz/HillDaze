import { supabaseAdmin } from '@/lib/supabase';
import { delay, fetchWithRetry } from '@/lib/shared/api-utils';
import type { IngestSourceReport } from './congress-gov';

/**
 * Regulations.gov API v4 — requires API key.
 * Polite: 1s delay between paginated requests, retry with backoff.
 */

const PAGE_DELAY_MS = 1000;
const MAX_PAGES = 10;

export async function ingestRegulationsForOrg(orgId: string): Promise<IngestSourceReport> {
  const report: IngestSourceReport = {
    source: 'regulations_gov',
    status: 'success',
    items_found: 0,
    items_ingested: 0,
    errors: 0,
    details: '',
  };

  const { data: config } = await supabaseAdmin
    .from('intel_api_source_config')
    .select('*')
    .eq('org_id', orgId)
    .eq('source_type', 'regulations_gov')
    .eq('active', true)
    .limit(1)
    .single();

  if (!config || !config.api_key) {
    report.status = 'skipped';
    report.details = 'No Regulations.gov API key configured';
    return report;
  }

  const searchTerms: string[] = config.search_terms || [];
  const lastFetched = config.last_fetched_at
    ? new Date(config.last_fetched_at).toISOString().split('T')[0]
    : new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  let pageNumber = 1;
  let hasMore = true;

  while (hasMore && pageNumber <= MAX_PAGES) {
    const params = new URLSearchParams({
      'filter[searchTerm]': searchTerms.join(' '),
      'filter[postedDate][ge]': lastFetched,
      'sort': '-postedDate',
      'page[size]': '50',
      'page[number]': String(pageNumber),
      'api_key': config.api_key,
    });

    const url = `https://api.regulations.gov/v4/documents?${params.toString()}`;
    const resp = await fetchWithRetry(url, 3, { headers: { Accept: 'application/json' } });

    if (!resp) {
      report.errors++;
      break;
    }

    const docs = ((resp.data || []) as Record<string, unknown>[]);
    if (docs.length === 0) { hasMore = false; break; }

    for (const doc of docs) {
      try {
        const attrs = (doc.attributes || {}) as Record<string, unknown>;
        const sourceUrl = attrs.objectId
          ? `https://www.regulations.gov/document/${attrs.objectId}`
          : ((doc.links as Record<string, string>)?.self || '');

        if (!sourceUrl) continue;

        const { count } = await supabaseAdmin
          .from('intel_news_items')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('source_url', sourceUrl);

        if (count && count > 0) continue;

        const rawContent = [
          attrs.title as string,
          (attrs.abstract as string) || (attrs.summary as string) || '',
          attrs.agencyId ? `Agency: ${attrs.agencyId}` : '',
          attrs.commentEndDate ? `Comments due: ${attrs.commentEndDate}` : '',
        ].filter(Boolean).join('\n\n');

        await supabaseAdmin.from('intel_news_items').insert({
          org_id: orgId,
          source_type: 'regulations_gov',
          source_url: sourceUrl,
          title: (attrs.title as string) || 'Untitled',
          raw_content: rawContent || null,
          summary: null,
          relevance_score: null,
        });
        report.items_ingested++;
      } catch {
        report.errors++;
      }
    }

    report.items_found += docs.length;
    const meta = resp.meta as Record<string, Record<string, number>> | undefined;
    const totalPages = meta?.totalPages?.valueOf?.() || meta?.page_count || 1;
    hasMore = pageNumber < (totalPages as number) && pageNumber < MAX_PAGES;
    pageNumber++;

    if (hasMore) await delay(PAGE_DELAY_MS);
  }

  await supabaseAdmin
    .from('intel_api_source_config')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('id', config.id);

  report.details = `Found ${report.items_found} documents, ingested ${report.items_ingested} new`;
  if (report.errors > 0) report.status = 'partial';

  return report;
}
