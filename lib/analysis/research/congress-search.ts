import { supabaseAdmin } from '@/lib/supabase';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { delay, fetchWithRetry, extractLastName, getStateAbbreviation } from '@/lib/shared/api-utils';
import type { AnalysisProfile } from '../types';
import { checkForAnomalies } from './anomaly-detection';

interface ResearchResult {
  items_created: number;
  errors: string[];
}

const CONGRESS_BASE = 'https://api.congress.gov/v3';
const PAGE_DELAY_MS = 1000;
const OPERATION_DELAY_MS = 2000;
const MAX_PER_PAGE = 250;

// ── Main entry point ────────────────────────────────────────────────

export interface CongressSearchOptions {
  since?: string | null; // ISO timestamp — only fetch items newer than this
}

export async function searchCongress(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string,
  options: CongressSearchOptions = {}
): Promise<ResearchResult> {
  if (profile.position_type !== 'congress_member') {
    return { items_created: 0, errors: [] };
  }

  const result: ResearchResult = { items_created: 0, errors: [] };

  // Step 1: Resolve bioguideId (check cache first)
  let bioguideId: string | null = null;
  try {
    bioguideId = await resolveBioguideId(profile, apiKey);
  } catch (err) {
    result.errors.push(`Member lookup failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!bioguideId) {
    result.errors.push('Could not find member in Congress.gov');
    try {
      const count = await searchBillsByKeyword(profile, orgId, apiKey);
      result.items_created += count;
    } catch (err) {
      result.errors.push(`Keyword bill search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return result;
  }

  // Step 2: Sponsored legislation (paginated)
  try {
    const count = await fetchPaginatedLegislation(
      profile, orgId, apiKey, bioguideId, 'sponsored-legislation', 'sponsoredLegislation', 'sponsored', options.since
    );
    result.items_created += count;
    console.log(`[analysis/congress] Sponsored: ${count} items ingested`);
  } catch (err) {
    result.errors.push(`Sponsored bills failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  await delay(OPERATION_DELAY_MS);

  // Step 3: Co-sponsored legislation (paginated)
  try {
    const count = await fetchPaginatedLegislation(
      profile, orgId, apiKey, bioguideId, 'cosponsored-legislation', 'cosponsoredLegislation', 'cosponsored', options.since
    );
    result.items_created += count;
    console.log(`[analysis/congress] Cosponsored: ${count} items ingested`);
  } catch (err) {
    result.errors.push(`Cosponsored bills failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  await delay(OPERATION_DELAY_MS);

  // Step 4: Voting pattern summary (Claude analysis of sponsored/cosponsored bills)
  try {
    const count = await generateVotingPatternSummary(profile, orgId);
    result.items_created += count;
  } catch (err) {
    result.errors.push(`Voting summary failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  await delay(OPERATION_DELAY_MS);

  // Step 5: Congressional Record (floor speeches)
  try {
    const count = await searchCongressionalRecord(profile, orgId, apiKey);
    result.items_created += count;
  } catch (err) {
    result.errors.push(`Congressional Record search failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

// ── Helper: check duplicate source_url for a profile ────────────────

async function isDuplicate(profileId: string, sourceUrl: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('analysis_data_items')
    .select('id')
    .eq('profile_id', profileId)
    .eq('source_url', sourceUrl)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// ── 1. Resolve bioguideId ───────────────────────────────────────────

async function resolveBioguideId(
  profile: AnalysisProfile,
  apiKey: string
): Promise<string | null> {
  // Check external_ids cache first
  const externalIds = (profile as unknown as Record<string, unknown>).external_ids as Record<string, string> | undefined;
  if (externalIds?.bioguide) {
    console.log(`[analysis/congress] Using cached bioguide: ${externalIds.bioguide}`);
    return externalIds.bioguide;
  }

  // Legacy: check baseline_attributes
  const metaBioguide = (profile.baseline_attributes as Record<string, unknown>)?.bioguideId;
  if (typeof metaBioguide === 'string' && metaBioguide.length > 0) {
    // Migrate to external_ids
    await cacheBioguideId(profile.id, metaBioguide);
    return metaBioguide;
  }

  const lastName = extractLastName(profile.full_name).toLowerCase();
  const firstName = (profile.full_name.replace(/^(Sen\.|Rep\.|Senator|Representative)\s*/i, '').split(/\s+/)[0] || '').toLowerCase();

  // Strategy 1: Search by state on current congress
  if (profile.state) {
    const stateAbbrev = getStateAbbreviation(profile.state);
    if (stateAbbrev) {
      const url = `${CONGRESS_BASE}/member/congress/119/${stateAbbrev}?api_key=${apiKey}&format=json&limit=50&currentMember=true`;
      const resp = await fetchWithRetry(url);
      if (resp?.members) {
        const match = findBestMemberMatch(resp.members as Record<string, unknown>[], lastName, firstName, profile);
        if (match) {
          await cacheBioguideId(profile.id, match);
          return match;
        }
      }
    }
  }

  // Strategy 2: Search member endpoint by name
  const url = `${CONGRESS_BASE}/member?query=${encodeURIComponent(profile.full_name)}&limit=20&api_key=${apiKey}&format=json`;
  const resp = await fetchWithRetry(url);
  if (resp?.members) {
    const match = findBestMemberMatch(resp.members as Record<string, unknown>[], lastName, firstName, profile);
    if (match) {
      await cacheBioguideId(profile.id, match);
      return match;
    }
  }

  await delay(PAGE_DELAY_MS);

  // Strategy 3: Broader search across recent congresses
  for (const congress of [118, 117, 116, 115]) {
    await delay(PAGE_DELAY_MS);
    const searchUrl = `${CONGRESS_BASE}/member/congress/${congress}?api_key=${apiKey}&format=json&limit=${MAX_PER_PAGE}`;
    const cResp = await fetchWithRetry(searchUrl);
    if (cResp?.members) {
      const match = findBestMemberMatch(cResp.members as Record<string, unknown>[], lastName, firstName, profile);
      if (match) {
        await cacheBioguideId(profile.id, match);
        return match;
      }
    }
  }

  return null;
}

function findBestMemberMatch(
  members: Record<string, unknown>[],
  lastName: string,
  firstName: string,
  profile: AnalysisProfile
): string | null {
  let bestMatch: { bioguideId: string; score: number } | null = null;

  for (const m of members) {
    let score = 0;
    const mName = (String(m.name || '')).toLowerCase();

    if (!mName.includes(lastName)) continue;
    score += 3;
    if (mName.includes(firstName)) score += 2;
    if (profile.state && m.state === profile.state) score += 3;
    if (profile.party) {
      const partyLetter = profile.party.charAt(0).toUpperCase();
      if (String(m.partyName || '').charAt(0).toUpperCase() === partyLetter) score += 1;
    }
    if (profile.district && m.district === profile.district) score += 2;

    const bioId = m.bioguideId as string | undefined;
    if (bioId && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { bioguideId: bioId, score };
    }
  }

  return bestMatch?.bioguideId || null;
}

async function cacheBioguideId(profileId: string, bioguideId: string) {
  try {
    const { data: current } = await supabaseAdmin
      .from('analysis_profiles')
      .select('external_ids, full_name')
      .eq('id', profileId)
      .single();

    const existing = (current?.external_ids || {}) as Record<string, unknown>;
    await supabaseAdmin
      .from('analysis_profiles')
      .update({
        external_ids: {
          ...existing,
          bioguide: bioguideId,
          bioguide_resolved_for: current?.full_name || '',
        },
      })
      .eq('id', profileId);

    console.log(`[analysis/congress] Cached bioguide ID ${bioguideId} for profile ${profileId}`);
  } catch {
    // Non-fatal — column may not exist yet
  }
}

// ── 2/3. Paginated Legislation Fetch ──────────────────────────────

async function fetchPaginatedLegislation(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string,
  bioguideId: string,
  endpoint: string,
  responseKey: string,
  subcategory: string,
  since?: string | null
): Promise<number> {
  let offset = 0;
  let created = 0;
  let totalAvailable = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      let url = `${CONGRESS_BASE}/member/${bioguideId}/${endpoint}?api_key=${apiKey}&format=json&limit=${MAX_PER_PAGE}&offset=${offset}`;
      if (since) {
        url += `&fromDateTime=${encodeURIComponent(since)}`;
      }
      const resp = await fetchWithRetry(url);

      if (!resp || !resp[responseKey]) {
        console.error(`[analysis/congress] Failed to fetch ${endpoint} at offset ${offset}`);
        break;
      }

      if (offset === 0) {
        const pagination = resp.pagination as Record<string, number> | undefined;
        totalAvailable = pagination?.count || 0;
        console.log(`[analysis/congress] ${totalAvailable} ${endpoint} items for ${bioguideId}`);
      }

      const bills = (resp[responseKey] || []) as Record<string, unknown>[];
      if (bills.length === 0) { hasMore = false; break; }

      for (const bill of bills) {
        try {
          // Congress.gov API returns `url` as the API URL, not the web URL.
          // Build a proper web URL from bill type, congress, and number.
          const billType = String(bill.type || '').toLowerCase(); // e.g., "s", "hr", "sres"
          const billNumber = String(bill.number || '');
          const billCongress = String(bill.congress || '');
          // Congress.gov list endpoints may use `title` or `latestTitle`
          const billTitle = String(bill.title || bill.latestTitle || '');

          // Map API type codes to congress.gov web URL path segments
          const typeMap: Record<string, string> = {
            s: 'senate-bill', hr: 'house-bill', sres: 'senate-resolution',
            hres: 'house-resolution', sjres: 'senate-joint-resolution',
            hjres: 'house-joint-resolution', sconres: 'senate-concurrent-resolution',
            hconres: 'house-concurrent-resolution',
          };
          const webType = typeMap[billType] || billType;

          const sourceUrl = billCongress && billNumber
            ? `https://www.congress.gov/bill/${billCongress}th-congress/${webType}/${billNumber}`
            : (bill.url as string) || `https://www.congress.gov/bill/${billCongress}/${billType}/${billNumber}`;

          if (await isDuplicate(profile.id, sourceUrl)) continue;

          // Build a readable title: "S. 4111: Windfall Profits Excise Tax Act of 2026"
          const typeLabel = billType.toUpperCase();
          const numberPart = billNumber ? `${typeLabel}. ${billNumber}` : typeLabel;
          const title = billTitle
            ? `${numberPart}: ${billTitle}`
            : (numberPart || 'Untitled Bill');

          const latestAction = bill.latestAction as Record<string, string> | undefined;
          const policyArea = bill.policyArea as Record<string, string> | undefined;

          const summary = [
            billTitle,
            subcategory === 'sponsored' ? `Sponsor: ${profile.full_name} (primary)` : `Cosponsor: ${profile.full_name}`,
            latestAction?.text ? `Latest Action: ${latestAction.text} (${latestAction.actionDate})` : '',
            policyArea?.name ? `Policy Area: ${policyArea.name}` : '',
            bill.introducedDate ? `Introduced: ${bill.introducedDate}` : '',
          ].filter(Boolean).join('\n');

          const keyTopics: string[] = [];
          if (policyArea?.name) keyTopics.push(policyArea.name);

          const anomaly = checkForAnomalies(profile, { title, summary });

          await supabaseAdmin.from('analysis_data_items').insert({
            profile_id: profile.id,
            org_id: orgId,
            category: 'bill',
            subcategory,
            title,
            summary,
            key_topics: keyTopics,
            source_url: sourceUrl,
            source_name: 'congress.gov',
            source_trust_level: 'trusted',
            item_date: latestAction?.actionDate || (bill.introducedDate as string) || null,
            verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
            anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
          });
          created++;
        } catch (itemErr) {
          console.error(`[analysis/congress] Error processing bill in ${endpoint}:`, itemErr);
          // Skip this bill but continue with the rest
        }
      }

      offset += bills.length;
      hasMore = offset < totalAvailable && bills.length === MAX_PER_PAGE;

      if (hasMore) {
        console.log(`[analysis/congress] ${endpoint}: ${offset}/${totalAvailable}, pausing...`);
        await delay(PAGE_DELAY_MS);
      }
    } catch (pageErr) {
      console.error(`[analysis/congress] Page fetch error for ${endpoint} at offset ${offset}:`, pageErr);
      // Stop pagination for this source but don't crash the pipeline
      break;
    }
  }

  return created;
}

// ── 4. Voting Pattern Summary (Claude analysis) ─────────────────────

async function generateVotingPatternSummary(
  profile: AnalysisProfile,
  orgId: string
): Promise<number> {
  const summarySourceUrl = `analysis://voting-pattern-summary/${profile.id}`;
  if (await isDuplicate(profile.id, summarySourceUrl)) return 0;

  const { data: billItems } = await supabaseAdmin
    .from('analysis_data_items')
    .select('title, summary, subcategory, key_topics, item_date')
    .eq('profile_id', profile.id)
    .eq('category', 'bill')
    .order('item_date', { ascending: false })
    .limit(100);

  if (!billItems || billItems.length === 0) return 0;

  const billSummaries = billItems
    .map((b) => `[${b.subcategory || 'bill'}] ${b.title}\n  Topics: ${(b.key_topics || []).join(', ')}\n  Date: ${b.item_date || 'unknown'}`)
    .join('\n\n');

  const claudeResponse = await callClaude({
    system: `You are an expert congressional analyst. Analyze the legislative activity of a member of Congress and produce a concise voting/legislative pattern summary. Focus on:
1. Key policy areas and issue priorities (rank by frequency)
2. Bipartisan vs. party-line activity indicators
3. Notable legislative themes or patterns
4. Any shifts in focus over time
Keep your response factual, under 500 words, in plain prose paragraphs. Do not use bullet points.`,
    userMessage: `Member: ${profile.full_name}
Party: ${profile.party || 'Unknown'}
State: ${profile.state || 'Unknown'}
District: ${profile.district || 'N/A'}

Here are ${billItems.length} bills this member has sponsored or co-sponsored:

${billSummaries}`,
    maxTokens: 1024,
  });

  await logApiUsage({
    orgId,
    endpoint: 'analysis/voting-pattern-summary',
    model: 'claude-sonnet-4-20250514',
    inputTokens: claudeResponse.inputTokens,
    outputTokens: claudeResponse.outputTokens,
  });

  const title = `Legislative Pattern Summary: ${profile.full_name}`;
  const summary = claudeResponse.text;

  const topicCounts: Record<string, number> = {};
  for (const b of billItems) {
    for (const t of b.key_topics || []) {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }
  }
  const keyTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t);

  const anomaly = checkForAnomalies(profile, { title, summary });

  await supabaseAdmin.from('analysis_data_items').insert({
    profile_id: profile.id,
    org_id: orgId,
    category: 'vote',
    subcategory: 'pattern_summary',
    title,
    summary,
    key_topics: keyTopics,
    source_url: summarySourceUrl,
    source_name: 'congress.gov',
    source_trust_level: 'trusted',
    item_date: new Date().toISOString().split('T')[0],
    verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
    anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
  });

  return 1;
}

// ── 5. Congressional Record (floor speeches) ────────────────────────

async function searchCongressionalRecord(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string
): Promise<number> {
  const url = `${CONGRESS_BASE}/congressional-record?query=${encodeURIComponent(profile.full_name)}&limit=50&api_key=${apiKey}&format=json`;
  const resp = await fetchWithRetry(url);

  if (!resp) {
    throw new Error('Congressional Record API request failed');
  }

  const records = (resp.Results || resp.congressionalRecord || resp.results || []) as Record<string, unknown>[];

  const articles: Array<Record<string, unknown>> = [];
  if (Array.isArray(records)) {
    for (const record of records) {
      if (Array.isArray(record.Articles)) {
        articles.push(...(record.Articles as Record<string, unknown>[]));
      } else if (Array.isArray(record.articles)) {
        articles.push(...(record.articles as Record<string, unknown>[]));
      } else {
        articles.push(record);
      }
    }
  }

  let created = 0;

  for (const article of articles) {
    const articleTitle = (article.title as string) || (article.Title as string) || '';
    const articleUrl = (article.url as string) || (article.Url as string) || (article.pdf as string) || '';

    const sourceUrl =
      articleUrl ||
      `https://www.congress.gov/congressional-record/${article.issueDate || article.date || 'unknown'}/${encodeURIComponent(articleTitle.slice(0, 80))}`;

    if (await isDuplicate(profile.id, sourceUrl)) continue;

    const title = articleTitle || 'Congressional Record Entry';
    const section = (article.sectionName as string) || (article.type as string) || '';
    const issueDate = (article.issueDate as string) || (article.date as string) || null;
    const startPage = article.startPage || article.pageRange || '';

    const summary = [
      articleTitle,
      section ? `Section: ${section}` : '',
      startPage ? `Page: ${startPage}` : '',
      issueDate ? `Date: ${issueDate}` : '',
    ].filter(Boolean).join('\n');

    const keyTopics: string[] = ['congressional record', 'floor activity'];
    if (section) keyTopics.push(section.toLowerCase());

    const anomaly = checkForAnomalies(profile, { title, summary });

    await supabaseAdmin.from('analysis_data_items').insert({
      profile_id: profile.id,
      org_id: orgId,
      category: 'speech',
      subcategory: 'congressional_record',
      title,
      summary,
      key_topics: keyTopics,
      source_url: sourceUrl,
      source_name: 'congress.gov',
      source_trust_level: 'trusted',
      item_date: issueDate,
      verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
      anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
    });
    created++;
  }

  return created;
}

// ── Fallback: Keyword bill search (used when bioguideId not found) ──

async function searchBillsByKeyword(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string
): Promise<number> {
  const searchName = extractLastName(profile.full_name);
  const url = `${CONGRESS_BASE}/bill?query=${encodeURIComponent(searchName)}&sort=updateDate+desc&limit=50&api_key=${apiKey}&format=json`;
  const resp = await fetchWithRetry(url);

  if (!resp) {
    throw new Error('Congress.gov bill API request failed');
  }

  const bills = (resp.bills || []) as Record<string, unknown>[];
  let created = 0;

  for (const bill of bills) {
    try {
      const billType = String(bill.type || '').toLowerCase();
      const billNumber = String(bill.number || '');
      const billCongress = String(bill.congress || '');
      const billTitle = String(bill.title || bill.latestTitle || '');

      const typeMap: Record<string, string> = {
        s: 'senate-bill', hr: 'house-bill', sres: 'senate-resolution',
        hres: 'house-resolution', sjres: 'senate-joint-resolution',
        hjres: 'house-joint-resolution', sconres: 'senate-concurrent-resolution',
        hconres: 'house-concurrent-resolution',
      };
      const webType = typeMap[billType] || billType;

      const sourceUrl = billCongress && billNumber
        ? `https://www.congress.gov/bill/${billCongress}th-congress/${webType}/${billNumber}`
        : (bill.url as string) || `https://www.congress.gov/bill/${billCongress}/${billType}/${billNumber}`;

      if (await isDuplicate(profile.id, sourceUrl)) continue;

      const typeLabel = billType.toUpperCase();
      const numberPart = billNumber ? `${typeLabel}. ${billNumber}` : typeLabel;
      const title = billTitle
        ? `${numberPart}: ${billTitle}`
        : (numberPart || 'Untitled Bill');

      const latestAction = bill.latestAction as Record<string, string> | undefined;
      const policyArea = bill.policyArea as Record<string, string> | undefined;

      const summary = [
        billTitle,
        latestAction?.text ? `Latest Action: ${latestAction.text} (${latestAction.actionDate})` : '',
        policyArea?.name ? `Policy Area: ${policyArea.name}` : '',
      ].filter(Boolean).join('\n');

      const keyTopics: string[] = [];
      if (policyArea?.name) keyTopics.push(policyArea.name);

      const anomaly = checkForAnomalies(profile, { title, summary });

      await supabaseAdmin.from('analysis_data_items').insert({
        profile_id: profile.id,
        org_id: orgId,
        category: 'bill',
        subcategory: billType || null,
        title,
        summary,
        key_topics: keyTopics,
        source_url: sourceUrl,
        source_name: 'congress.gov',
        source_trust_level: 'trusted',
        item_date: latestAction?.actionDate || (bill.updateDate as string) || null,
        verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
        anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
      });
      created++;
    } catch (itemErr) {
      console.error('[analysis/congress] Error processing keyword bill:', itemErr);
    }
  }

  return created;
}
