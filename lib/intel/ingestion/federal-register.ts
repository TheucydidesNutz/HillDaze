import { supabaseAdmin } from '@/lib/supabase';
import { delay, fetchWithRetry } from '@/lib/shared/api-utils';
import type { IngestSourceReport } from './congress-gov';

/**
 * Federal Register API v1 — free, no key required.
 * Polite: 1s delay between paginated requests, retry on failure.
 */

const PAGE_DELAY_MS = 1000;
const MAX_PAGES = 10;

export async function ingestFederalRegisterForOrg(orgId: string): Promise<IngestSourceReport> {
  const report: IngestSourceReport = {
    source: 'federal_register',
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
    .eq('source_type', 'federal_register')
    .eq('active', true)
    .limit(1)
    .single();

  if (!config) {
    report.status = 'skipped';
    report.details = 'No Federal Register config';
    return report;
  }

  const searchTerms: string[] = config.search_terms || [];
  const filters = (config.filters || {}) as { document_types?: string[]; agencies?: string[] };
  const lastFetched = config.last_fetched_at
    ? new Date(config.last_fetched_at).toISOString().split('T')[0]
    : new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
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
    params.set('page', String(page));
    params.set('order', 'newest');

    const url = `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`;
    const resp = await fetchWithRetry(url);

    if (!resp) {
      report.errors++;
      break;
    }

    const results = (resp.results || []) as Record<string, unknown>[];
    if (results.length === 0) { hasMore = false; break; }

    for (const doc of results) {
      try {
        const sourceUrl = (doc.html_url as string) || (doc.pdf_url as string) || '';
        if (!sourceUrl) continue;

        const { count } = await supabaseAdmin
          .from('intel_news_items')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('source_url', sourceUrl);

        if (count && count > 0) continue;

        const agencies = doc.agencies as Array<{ name: string }> | undefined;
        const rawContent = [
          doc.abstract as string,
          doc.action ? `Action: ${doc.action}` : '',
          doc.dates ? `Dates: ${doc.dates}` : '',
          agencies?.map(a => a.name).join(', '),
        ].filter(Boolean).join('\n\n');

        await supabaseAdmin.from('intel_news_items').insert({
          org_id: orgId,
          source_type: 'federal_register',
          source_url: sourceUrl,
          title: (doc.title as string) || 'Untitled',
          raw_content: rawContent || null,
          summary: null,
          relevance_score: null,
        });
        report.items_ingested++;
      } catch {
        report.errors++;
      }
    }

    report.items_found += results.length;
    const totalPages = (resp.total_pages as number) || 1;
    hasMore = page < totalPages && page < MAX_PAGES;
    page++;

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
