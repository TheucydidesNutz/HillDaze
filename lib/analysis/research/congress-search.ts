import { supabaseAdmin } from '@/lib/supabase';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import type { AnalysisProfile } from '../types';
import { checkForAnomalies } from './anomaly-detection';

interface ResearchResult {
  items_created: number;
  errors: string[];
}

const CONGRESS_API_BASE = 'https://api.congress.gov/v3';

// ── Main entry point ────────────────────────────────────────────────

export async function searchCongress(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string
): Promise<ResearchResult> {
  if (profile.position_type !== 'congress_member') {
    return { items_created: 0, errors: [] };
  }

  const result: ResearchResult = { items_created: 0, errors: [] };

  // Step 1: Resolve bioguideId
  let bioguideId: string | null = null;
  try {
    bioguideId = await resolveBioguideId(profile, apiKey);
  } catch (err) {
    result.errors.push(`Member lookup failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!bioguideId) {
    result.errors.push('Could not find member in Congress.gov');
    // Fall back to keyword search
    try {
      const count = await searchBillsByKeyword(profile, orgId, apiKey);
      result.items_created += count;
    } catch (err) {
      result.errors.push(`Keyword bill search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return result;
  }

  // Step 2: Sponsored legislation
  try {
    const count = await searchSponsoredLegislation(profile, orgId, apiKey, bioguideId);
    result.items_created += count;
  } catch (err) {
    result.errors.push(`Sponsored bills failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 3: Co-sponsored legislation
  try {
    const count = await searchCosponsoredLegislation(profile, orgId, apiKey, bioguideId);
    result.items_created += count;
  } catch (err) {
    result.errors.push(`Cosponsored bills failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 4: Voting pattern summary (Claude analysis of sponsored/cosponsored bills)
  try {
    const count = await generateVotingPatternSummary(profile, orgId);
    result.items_created += count;
  } catch (err) {
    result.errors.push(`Voting summary failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 5: Congressional Record (floor speeches)
  try {
    const count = await searchCongressionalRecord(profile, orgId, apiKey);
    result.items_created += count;
  } catch (err) {
    result.errors.push(`Congressional Record search failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

// ── Helper: safe Congress.gov fetch with retry on 429 ───────────────

async function congressFetch(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  // Congress.gov rate-limits aggressively — back off once on 429
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    return fetch(url, { headers: { Accept: 'application/json' } });
  }

  return res;
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
  // If profile metadata already has it, use that
  const metaBioguide = (profile.baseline_attributes as Record<string, unknown>)?.bioguideId;
  if (typeof metaBioguide === 'string' && metaBioguide.length > 0) {
    return metaBioguide;
  }

  // Search the member endpoint by full name
  const params = new URLSearchParams({
    query: profile.full_name,
    limit: '10',
    api_key: apiKey,
  });

  const res = await congressFetch(`${CONGRESS_API_BASE}/member?${params}`);
  if (!res.ok) {
    throw new Error(`Congress.gov member API returned ${res.status}`);
  }

  const data = await res.json();
  const members = data.members || [];

  if (members.length === 0) return null;

  const lastName = (profile.full_name.split(' ').pop() || '').toLowerCase();
  const firstName = (profile.full_name.split(' ')[0] || '').toLowerCase();

  // Score each member candidate and pick the best match
  let bestMatch: { bioguideId: string; score: number } | null = null;

  for (const m of members) {
    let score = 0;
    const mName = (m.name || '').toLowerCase();

    // Last name match (required)
    if (!mName.includes(lastName)) continue;
    score += 3;

    // First name match
    if (mName.includes(firstName)) score += 2;

    // State match
    if (profile.state && m.state === profile.state) score += 3;

    // Party match
    if (profile.party) {
      const partyLetter = profile.party.charAt(0).toUpperCase();
      if (m.partyName?.charAt(0).toUpperCase() === partyLetter) score += 1;
    }

    // District match (for House members)
    if (profile.district && m.district === profile.district) score += 2;

    const bioId = m.bioguideId || null;
    if (bioId && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { bioguideId: bioId, score };
    }
  }

  return bestMatch?.bioguideId || null;
}

// ── 2. Sponsored Legislation ────────────────────────────────────────

async function searchSponsoredLegislation(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string,
  bioguideId: string
): Promise<number> {
  const url = `${CONGRESS_API_BASE}/member/${bioguideId}/sponsored-legislation?api_key=${apiKey}&limit=250`;
  const res = await congressFetch(url);

  if (!res.ok) {
    throw new Error(`Sponsored legislation API returned ${res.status}`);
  }

  const data = await res.json();
  const bills = data.sponsoredLegislation || [];
  let created = 0;

  for (const bill of bills) {
    const sourceUrl =
      bill.url ||
      `https://www.congress.gov/bill/${bill.congress}/${(bill.type || '').toLowerCase()}/${bill.number}`;

    if (await isDuplicate(profile.id, sourceUrl)) continue;

    const title = `${bill.type || ''}${bill.number || ''}: ${bill.title || 'Untitled'}`;
    const summary = [
      bill.title,
      `Sponsor: ${profile.full_name} (primary)`,
      bill.latestAction?.text
        ? `Latest Action: ${bill.latestAction.text} (${bill.latestAction.actionDate})`
        : '',
      bill.policyArea?.name ? `Policy Area: ${bill.policyArea.name}` : '',
      bill.introducedDate ? `Introduced: ${bill.introducedDate}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const keyTopics: string[] = [];
    if (bill.policyArea?.name) keyTopics.push(bill.policyArea.name);

    const anomaly = checkForAnomalies(profile, { title, summary });

    await supabaseAdmin.from('analysis_data_items').insert({
      profile_id: profile.id,
      org_id: orgId,
      category: 'bill',
      subcategory: 'sponsored',
      title,
      summary,
      key_topics: keyTopics,
      source_url: sourceUrl,
      source_name: 'congress.gov',
      source_trust_level: 'trusted',
      item_date: bill.latestAction?.actionDate || bill.introducedDate || null,
      verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
      anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
    });
    created++;
  }

  return created;
}

// ── 3. Co-sponsored Legislation ─────────────────────────────────────

async function searchCosponsoredLegislation(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string,
  bioguideId: string
): Promise<number> {
  const url = `${CONGRESS_API_BASE}/member/${bioguideId}/cosponsored-legislation?api_key=${apiKey}&limit=250`;
  const res = await congressFetch(url);

  if (!res.ok) {
    throw new Error(`Cosponsored legislation API returned ${res.status}`);
  }

  const data = await res.json();
  const bills = data.cosponsoredLegislation || [];
  let created = 0;

  for (const bill of bills) {
    const sourceUrl =
      bill.url ||
      `https://www.congress.gov/bill/${bill.congress}/${(bill.type || '').toLowerCase()}/${bill.number}`;

    if (await isDuplicate(profile.id, sourceUrl)) continue;

    const title = `${bill.type || ''}${bill.number || ''}: ${bill.title || 'Untitled'}`;
    const summary = [
      bill.title,
      `Cosponsor: ${profile.full_name}`,
      bill.latestAction?.text
        ? `Latest Action: ${bill.latestAction.text} (${bill.latestAction.actionDate})`
        : '',
      bill.policyArea?.name ? `Policy Area: ${bill.policyArea.name}` : '',
      bill.introducedDate ? `Introduced: ${bill.introducedDate}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const keyTopics: string[] = [];
    if (bill.policyArea?.name) keyTopics.push(bill.policyArea.name);

    const anomaly = checkForAnomalies(profile, { title, summary });

    await supabaseAdmin.from('analysis_data_items').insert({
      profile_id: profile.id,
      org_id: orgId,
      category: 'bill',
      subcategory: 'cosponsored',
      title,
      summary,
      key_topics: keyTopics,
      source_url: sourceUrl,
      source_name: 'congress.gov',
      source_trust_level: 'trusted',
      item_date: bill.latestAction?.actionDate || bill.introducedDate || null,
      verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
      anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
    });
    created++;
  }

  return created;
}

// ── 4. Voting Pattern Summary (Claude analysis) ─────────────────────

async function generateVotingPatternSummary(
  profile: AnalysisProfile,
  orgId: string
): Promise<number> {
  // Check if we already have a recent voting summary
  const summarySourceUrl = `analysis://voting-pattern-summary/${profile.id}`;
  if (await isDuplicate(profile.id, summarySourceUrl)) return 0;

  // Fetch all bill items for this profile to give Claude context
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

  // Extract top topics from bills
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
  const searchName = profile.full_name;
  const params = new URLSearchParams({
    query: searchName,
    limit: '50',
    api_key: apiKey,
  });

  const res = await congressFetch(`${CONGRESS_API_BASE}/congressional-record?${params}`);
  if (!res.ok) {
    throw new Error(`Congressional Record API returned ${res.status}`);
  }

  const data = await res.json();
  // The CR endpoint returns results under "Results" or "congressionalRecord"
  const records = data.Results || data.congressionalRecord || data.results || [];

  // Normalize: the API may return grouped issues or individual articles
  const articles: Array<Record<string, unknown>> = [];
  if (Array.isArray(records)) {
    for (const record of records) {
      // Each record may be an issue containing articles, or an article itself
      if (record.Articles && Array.isArray(record.Articles)) {
        articles.push(...record.Articles);
      } else if (record.articles && Array.isArray(record.articles)) {
        articles.push(...record.articles);
      } else {
        // Treat the record itself as an article
        articles.push(record);
      }
    }
  }

  let created = 0;

  for (const article of articles) {
    const articleTitle = (article.title as string) || (article.Title as string) || '';
    const articleUrl =
      (article.url as string) ||
      (article.Url as string) ||
      (article.pdf as string) ||
      '';

    // Build a stable source URL — if no direct URL, synthesize one from available data
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
    ]
      .filter(Boolean)
      .join('\n');

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
  const searchName = profile.full_name.split(' ').pop() || profile.full_name;
  const params = new URLSearchParams({
    query: searchName,
    sort: 'updateDate+desc',
    limit: '50',
    api_key: apiKey,
  });

  const res = await congressFetch(`${CONGRESS_API_BASE}/bill?${params}`);
  if (!res.ok) {
    throw new Error(`Congress.gov bill API returned ${res.status}`);
  }

  const data = await res.json();
  const bills = data.bills || [];
  let created = 0;

  for (const bill of bills) {
    const sourceUrl =
      bill.url ||
      `https://www.congress.gov/bill/${bill.congress}/${(bill.type || '').toLowerCase()}/${bill.number}`;

    if (await isDuplicate(profile.id, sourceUrl)) continue;

    const title = `${bill.type || ''}${bill.number || ''}: ${bill.title || 'Untitled'}`;
    const summary = [
      bill.title,
      bill.latestAction?.text
        ? `Latest Action: ${bill.latestAction.text} (${bill.latestAction.actionDate})`
        : '',
      bill.policyArea?.name ? `Policy Area: ${bill.policyArea.name}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const keyTopics: string[] = [];
    if (bill.policyArea?.name) keyTopics.push(bill.policyArea.name);
    if (bill.subjects?.length) {
      for (const s of bill.subjects.slice(0, 5)) {
        if (s.name) keyTopics.push(s.name);
      }
    }

    const anomaly = checkForAnomalies(profile, { title, summary });

    await supabaseAdmin.from('analysis_data_items').insert({
      profile_id: profile.id,
      org_id: orgId,
      category: 'bill',
      subcategory: bill.type || null,
      title,
      summary,
      key_topics: keyTopics,
      source_url: sourceUrl,
      source_name: 'congress.gov',
      source_trust_level: 'trusted',
      item_date: bill.latestAction?.actionDate || bill.updateDate || null,
      verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
      anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
    });
    created++;
  }

  return created;
}
