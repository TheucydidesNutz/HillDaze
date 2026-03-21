import { supabaseAdmin } from '@/lib/supabase';
import { delay, fetchWithRetry } from '@/lib/shared/api-utils';

/**
 * Congress.gov API v3 — topical bill search for /intel.
 * Searches by KEYWORD (not by member). Paginates politely.
 *
 * Rate limit: 5,000 requests/hour. We use 250/page with 1s delay.
 */

const CONGRESS_BASE = 'https://api.congress.gov/v3';
const PAGE_DELAY_MS = 1000;
const OPERATION_DELAY_MS = 2000;
const MAX_PER_PAGE = 250;
const MAX_PAGES = 10; // Safety cap: 2,500 items max per search term

export interface IngestSourceReport {
  source: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  items_found: number;
  items_ingested: number;
  errors: number;
  details: string;
}

export async function ingestCongressForOrg(orgId: string): Promise<IngestSourceReport> {
  const report: IngestSourceReport = {
    source: 'congress.gov',
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
    .eq('source_type', 'congress_gov')
    .eq('active', true)
    .limit(1)
    .single();

  if (!config || !config.api_key) {
    report.status = 'skipped';
    report.details = 'No Congress.gov API key configured';
    return report;
  }

  const searchTerms: string[] = config.search_terms || [];
  if (searchTerms.length === 0) {
    report.status = 'skipped';
    report.details = 'No search terms configured';
    return report;
  }

  const apiKey = config.api_key;
  const lastFetched = config.last_fetched_at
    ? new Date(config.last_fetched_at).toISOString()
    : new Date(Date.now() - 7 * 86400000).toISOString();

  // Search for each term sequentially (polite to Congress.gov servers)
  for (const term of searchTerms) {
    let offset = 0;
    let pages = 0;
    let hasMore = true;

    while (hasMore && pages < MAX_PAGES) {
      const url = `${CONGRESS_BASE}/bill?query=${encodeURIComponent(term)}&fromDateTime=${encodeURIComponent(lastFetched)}&sort=updateDate+desc&limit=${MAX_PER_PAGE}&offset=${offset}&api_key=${apiKey}&format=json`;

      const resp = await fetchWithRetry(url);
      if (!resp || !resp.bills) {
        report.errors++;
        break;
      }

      const bills = (resp.bills || []) as Record<string, unknown>[];
      if (bills.length === 0) { hasMore = false; break; }

      for (const bill of bills) {
        try {
          const latestAction = bill.latestAction as Record<string, string> | undefined;
          const policyArea = bill.policyArea as Record<string, string> | undefined;

          const sourceUrl = (bill.url as string)
            ? (bill.url as string).replace('api.congress.gov/v3', 'congress.gov')
            : `https://www.congress.gov/bill/${bill.congress}/${String(bill.type || '').toLowerCase()}/${bill.number}`;

          // Dedup check
          const { count } = await supabaseAdmin
            .from('intel_news_items')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('source_url', sourceUrl);

          if (count && count > 0) continue;

          const rawContent = [
            bill.title as string,
            latestAction?.text ? `Latest Action: ${latestAction.text} (${latestAction.actionDate})` : '',
            policyArea?.name ? `Policy Area: ${policyArea.name}` : '',
          ].filter(Boolean).join('\n\n');

          await supabaseAdmin.from('intel_news_items').insert({
            org_id: orgId,
            source_type: 'congress',
            source_url: sourceUrl,
            title: `${bill.type || ''}${bill.number || ''}: ${bill.title || 'Untitled'}`.trim(),
            raw_content: rawContent || null,
            published_at: latestAction?.actionDate || (bill.introducedDate as string) || null,
            metadata: {
              congress: bill.congress,
              bill_type: bill.type,
              bill_number: bill.number,
              policy_area: policyArea?.name || null,
              search_term: term,
            },
          });
          report.items_ingested++;
        } catch {
          report.errors++;
        }
      }

      report.items_found += bills.length;
      offset += bills.length;
      pages++;
      hasMore = bills.length === MAX_PER_PAGE && pages < MAX_PAGES;

      if (hasMore) {
        console.log(`[intel/congress-gov] Term "${term}": ${offset} items, page ${pages}, pausing...`);
        await delay(PAGE_DELAY_MS);
      }
    }

    // Polite pause between search terms
    await delay(OPERATION_DELAY_MS);
  }

  // Update last_fetched_at
  await supabaseAdmin
    .from('intel_api_source_config')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('id', config.id);

  report.details = `Searched ${searchTerms.length} terms, found ${report.items_found} bills, ingested ${report.items_ingested} new`;
  if (report.errors > 0) report.status = 'partial';

  return report;
}
