/**
 * One-time backfill script: fix Congress.gov bill items with missing/bad titles.
 *
 * Finds analysis_data_items from congress.gov where the title is empty, "Untitled",
 * or starts with ":". Looks up the actual bill title from the Congress.gov API
 * and updates the record.
 *
 * Run with: npx tsx workers/analysis/backfill-bill-titles.ts
 */

import { supabase, log } from './worker-utils';
import { CONGRESS_API_KEY } from './config';

const WORKER = 'backfill-bill-titles';
const CONGRESS_BASE = 'https://api.congress.gov/v3';
const DELAY_MS = 1000; // 1 second between API calls — polite to Congress.gov

// Type map for web URLs
const TYPE_MAP: Record<string, string> = {
  s: 'senate-bill', hr: 'house-bill', sres: 'senate-resolution',
  hres: 'house-resolution', sjres: 'senate-joint-resolution',
  hjres: 'house-joint-resolution', sconres: 'senate-concurrent-resolution',
  hconres: 'house-concurrent-resolution',
};

async function main() {
  log(WORKER, 'Starting bill title backfill...');

  // Step 1: Find the API key. Try org_api_keys first, fall back to env.
  let apiKey = CONGRESS_API_KEY;

  if (!apiKey) {
    // Try to find one from any org's api keys
    const { data: keyRow } = await supabase
      .from('org_api_keys')
      .select('api_key')
      .eq('service_name', 'congress_gov')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (keyRow?.api_key) {
      apiKey = keyRow.api_key;
      log(WORKER, 'Using API key from org_api_keys table');
    }
  }

  if (!apiKey) {
    log(WORKER, 'ERROR: No Congress.gov API key available. Set CONGRESS_API_KEY env var or configure in org settings.');
    process.exit(1);
  }

  // Step 2: Find all broken bill items
  const { data: items, error } = await supabase
    .from('analysis_data_items')
    .select('id, title, source_url, source_name, category')
    .eq('source_name', 'congress.gov')
    .eq('category', 'bill')
    .or('title.is.null,title.like.%Untitled%,title.like.:%');

  if (error) {
    log(WORKER, `Error querying items: ${error.message}`);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    log(WORKER, 'No items with broken titles found. Nothing to do.');
    return;
  }

  log(WORKER, `Found ${items.length} items with broken titles`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      // Extract bill info from source_url
      // URL patterns:
      //   https://www.congress.gov/bill/119th-congress/senate-bill/4111
      //   https://www.congress.gov/bill/119/s/4111
      //   https://api.congress.gov/v3/bill/119/s/4111?format=json
      const parsed = parseBillFromUrl(item.source_url);

      if (!parsed) {
        log(WORKER, `  Skipping ${item.id}: could not parse source_url: ${item.source_url}`);
        skipped++;
        continue;
      }

      // Look up the bill from Congress.gov API
      const url = `${CONGRESS_BASE}/bill/${parsed.congress}/${parsed.type}/${parsed.number}?api_key=${apiKey}&format=json`;

      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          log(WORKER, `  Rate limited. Waiting 60 seconds...`);
          await delay(60000);
          // Retry once
          const retry = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
          if (!retry.ok) {
            log(WORKER, `  Failed after retry for ${item.id}: HTTP ${retry.status}`);
            failed++;
            continue;
          }
          const retryData = await retry.json();
          await processBillResponse(item, parsed, retryData);
          fixed++;
        } else {
          log(WORKER, `  HTTP ${resp.status} for ${item.id} (${parsed.type}${parsed.number})`);
          failed++;
          continue;
        }
      } else {
        const data = await resp.json();
        await processBillResponse(item, parsed, data);
        fixed++;
      }

      if ((fixed + failed + skipped) % 10 === 0 || fixed + failed + skipped === items.length) {
        log(WORKER, `Progress: ${fixed} fixed, ${failed} failed, ${skipped} skipped / ${items.length} total`);
      }

      // Polite delay
      await delay(DELAY_MS);

    } catch (err) {
      log(WORKER, `  Error processing ${item.id}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  log(WORKER, `\nBackfill complete: ${fixed} fixed, ${failed} failed, ${skipped} skipped out of ${items.length} total`);
}

interface ParsedBill {
  congress: string;
  type: string;    // lowercase: "s", "hr", "sres", etc.
  number: string;
}

function parseBillFromUrl(sourceUrl: string | null): ParsedBill | null {
  if (!sourceUrl) return null;

  // Pattern 1: /bill/119th-congress/senate-bill/4111
  const webMatch = sourceUrl.match(/\/bill\/(\d+)(?:th|st|nd|rd)-congress\/([\w-]+)\/(\d+)/);
  if (webMatch) {
    const congress = webMatch[1];
    const webType = webMatch[2];
    // Reverse map web type to API type
    const reverseMap: Record<string, string> = {};
    for (const [apiType, web] of Object.entries(TYPE_MAP)) {
      reverseMap[web] = apiType;
    }
    const type = reverseMap[webType] || webType;
    return { congress, type, number: webMatch[3] };
  }

  // Pattern 2: /bill/119/s/4111 (API URL or old format)
  const apiMatch = sourceUrl.match(/\/bill\/(\d+)\/([\w]+)\/(\d+)/);
  if (apiMatch) {
    return { congress: apiMatch[1], type: apiMatch[2].toLowerCase(), number: apiMatch[3] };
  }

  return null;
}

async function processBillResponse(
  item: { id: string; title: string | null },
  parsed: ParsedBill,
  data: Record<string, unknown>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bill = (data.bill || data) as any;
  const realTitle = bill.title || bill.latestTitle || bill.officialTitle || '';

  if (!realTitle) {
    log(WORKER, `  No title in API response for ${parsed.type}${parsed.number} (congress ${parsed.congress})`);
    return;
  }

  const typeLabel = parsed.type.toUpperCase();
  const newTitle = `${typeLabel}. ${parsed.number}: ${realTitle}`;

  // Also fix the summary if it starts with an empty line
  const { error: updateError } = await supabase
    .from('analysis_data_items')
    .update({ title: newTitle })
    .eq('id', item.id);

  if (updateError) {
    log(WORKER, `  DB update failed for ${item.id}: ${updateError.message}`);
  } else {
    log(WORKER, `  Fixed: "${item.title}" → "${newTitle.slice(0, 80)}..."`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  log(WORKER, `Fatal: ${err}`);
  process.exit(1);
});
