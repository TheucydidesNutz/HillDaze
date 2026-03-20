import { supabase, getAnthropic, log, logApiUsage } from './worker-utils';
import { CONGRESS_API_KEY, OPENSECRETS_API_KEY, COURTLISTENER_API_KEY } from './config';

const WORKER = 'analysis-research';

interface Profile {
  id: string;
  org_id: string;
  full_name: string;
  position_type: string;
  party: string | null;
  state: string | null;
  district: string | null;
  court: string | null;
  organization: string | null;
  aliases: string[];
}

async function main() {
  log(WORKER, 'Checking for pending research profiles...');

  // Find profiles with research_status='pending'
  const { data: profiles, error } = await supabase
    .from('analysis_profiles')
    .select('*')
    .eq('research_status', 'pending')
    .limit(5); // Process up to 5 at a time

  if (error) {
    log(WORKER, `Error fetching profiles: ${error.message}`);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    log(WORKER, 'No pending profiles found');
    return;
  }

  log(WORKER, `Found ${profiles.length} pending profiles`);

  for (const profile of profiles as Profile[]) {
    log(WORKER, `Processing: ${profile.full_name} (${profile.id})`);

    // Mark as in_progress
    await supabase
      .from('analysis_profiles')
      .update({ research_status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    // Log start
    await supabase.from('analysis_worker_logs').insert({
      worker_name: WORKER,
      profile_id: profile.id,
      status: 'started',
      message: `Starting research for ${profile.full_name}`,
    });

    // Set baseline attributes
    await supabase
      .from('analysis_profiles')
      .update({
        baseline_attributes: {
          full_name: profile.full_name,
          position_type: profile.position_type,
          party: profile.party,
          state: profile.state,
          district: profile.district,
          court: profile.court,
          organization: profile.organization,
        },
      })
      .eq('id', profile.id);

    // Ensure org has sources
    const { data: sources } = await supabase
      .from('analysis_source_registry')
      .select('id')
      .eq('org_id', profile.org_id)
      .limit(1);

    if (!sources || sources.length === 0) {
      await supabase.rpc('seed_analysis_org_sources', { p_org_id: profile.org_id });
    }

    let totalItems = 0;
    const results: Record<string, { items: number; errors: string[] }> = {};

    // Run web search (always)
    try {
      const webResult = await runWebSearch(profile);
      results.web_search = { items: webResult, errors: [] };
      totalItems += webResult;
      log(WORKER, `  Web search: ${webResult} items`);
    } catch (err) {
      results.web_search = { items: 0, errors: [String(err)] };
      log(WORKER, `  Web search failed: ${err}`);
    }

    // Run Wayback search (always)
    try {
      const waybackResult = await runWaybackSearch(profile);
      results.wayback = { items: waybackResult, errors: [] };
      totalItems += waybackResult;
      log(WORKER, `  Wayback: ${waybackResult} items`);
    } catch (err) {
      results.wayback = { items: 0, errors: [String(err)] };
      log(WORKER, `  Wayback failed: ${err}`);
    }

    // Congress.gov (congress_member only)
    if (CONGRESS_API_KEY && profile.position_type === 'congress_member') {
      try {
        const congressResult = await runCongressSearch(profile);
        results.congress = { items: congressResult, errors: [] };
        totalItems += congressResult;
        log(WORKER, `  Congress: ${congressResult} items`);
      } catch (err) {
        results.congress = { items: 0, errors: [String(err)] };
        log(WORKER, `  Congress failed: ${err}`);
      }
    }

    // OpenSecrets
    if (OPENSECRETS_API_KEY) {
      try {
        const osResult = await runOpenSecretsSearch(profile);
        results.opensecrets = { items: osResult, errors: [] };
        totalItems += osResult;
        log(WORKER, `  OpenSecrets: ${osResult} items`);
      } catch (err) {
        results.opensecrets = { items: 0, errors: [String(err)] };
        log(WORKER, `  OpenSecrets failed: ${err}`);
      }
    }

    // CourtListener (jurist only)
    if (COURTLISTENER_API_KEY && profile.position_type === 'jurist') {
      try {
        const clResult = await runCourtListenerSearch(profile);
        results.courtlistener = { items: clResult, errors: [] };
        totalItems += clResult;
        log(WORKER, `  CourtListener: ${clResult} items`);
      } catch (err) {
        results.courtlistener = { items: 0, errors: [String(err)] };
        log(WORKER, `  CourtListener failed: ${err}`);
      }
    }

    // Update status
    const finalStatus = totalItems === 0 && Object.values(results).every(r => r.errors.length > 0)
      ? 'error' : 'complete';

    await supabase
      .from('analysis_profiles')
      .update({ research_status: finalStatus, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    await supabase.from('analysis_worker_logs').insert({
      worker_name: WORKER,
      profile_id: profile.id,
      status: 'completed',
      message: `Research complete: ${totalItems} items created`,
      metadata: { results },
    });

    log(WORKER, `  Done: ${totalItems} items, status=${finalStatus}`);
  }

  log(WORKER, 'All profiles processed');
}

// --- Individual search implementations (simplified for worker context) ---

async function runWebSearch(profile: Profile): Promise<number> {
  const client = getAnthropic();
  const searches = [
    `"${profile.full_name}" public speech transcript`,
    `"${profile.full_name}" press conference`,
    `"${profile.full_name}" policy position`,
    `"${profile.full_name}" interview`,
    `"${profile.full_name}" podcast appearance transcript`,
  ];

  let totalCreated = 0;

  for (const query of searches) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 5 }],
        messages: [{
          role: 'user',
          content: `Search for: ${query}\n\nReturn ONLY a JSON array of results about ${profile.full_name} (${profile.position_type}${profile.state ? `, ${profile.state}` : ''}). Each result: {"title":"...","date":"YYYY-MM-DD or null","source_url":"...","source_name":"...","summary":"...","category":"speech|news|position|podcast","key_quotes":["..."]}. If no results, return [].`,
        }],
      });

      await logApiUsage(profile.org_id, 'analysis_web_search', 'claude-sonnet-4-20250514', response.usage.input_tokens, response.usage.output_tokens);

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') continue;

      let items: Array<{ title: string; date: string | null; source_url: string; source_name: string; summary: string; category: string; key_quotes: string[] }> = [];
      try {
        let jsonText = textBlock.text.trim();
        if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        items = JSON.parse(jsonText);
      } catch { continue; }

      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (!item.source_url || !item.title) continue;

        const { data: existing } = await supabase
          .from('analysis_data_items')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('source_url', item.source_url)
          .limit(1)
          .maybeSingle();

        if (existing) continue;

        // Simple anomaly check
        const anomalyFlags = checkAnomalies(profile, item.title, item.summary);

        await supabase.from('analysis_data_items').insert({
          profile_id: profile.id,
          org_id: profile.org_id,
          category: item.category || 'news',
          title: item.title,
          summary: item.summary,
          key_quotes: item.key_quotes || [],
          key_topics: [],
          source_url: item.source_url,
          source_name: item.source_name,
          source_trust_level: 'default',
          item_date: item.date || null,
          verification_status: anomalyFlags.length > 0 ? 'unverified' : 'verified',
          anomaly_flags: anomalyFlags.length > 0 ? { flags: anomalyFlags } : {},
        });
        totalCreated++;
      }
    } catch { continue; }
  }

  return totalCreated;
}

async function runWaybackSearch(profile: Profile): Promise<number> {
  const nameParts = profile.full_name.toLowerCase().split(' ');
  const handles = [
    nameParts.join(''),
    nameParts.join('_'),
    `rep${nameParts[nameParts.length - 1]}`,
    `sen${nameParts[nameParts.length - 1]}`,
  ];

  let created = 0;
  for (const handle of handles) {
    try {
      const res = await fetch(`https://web.archive.org/cdx/search/cdx?url=twitter.com/${handle}&output=json&limit=3&fl=timestamp,original&filter=statuscode:200`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length <= 1) continue;

      for (let i = 1; i < data.length; i++) {
        const [timestamp, originalUrl] = data[i] as [string, string];
        const archiveUrl = `https://web.archive.org/web/${timestamp}/${originalUrl}`;
        const date = `${timestamp.slice(0,4)}-${timestamp.slice(4,6)}-${timestamp.slice(6,8)}`;

        const { data: existing } = await supabase
          .from('analysis_data_items').select('id').eq('profile_id', profile.id).eq('source_url', archiveUrl).limit(1).maybeSingle();
        if (existing) continue;

        await supabase.from('analysis_data_items').insert({
          profile_id: profile.id, org_id: profile.org_id,
          category: 'social_media', subcategory: 'twitter_archive',
          title: `Archived Twitter/X: @${handle} (${date})`,
          summary: `Wayback Machine snapshot of @${handle}`,
          source_url: archiveUrl, source_name: 'web.archive.org',
          source_trust_level: 'default', item_date: date,
          verification_status: 'verified', anomaly_flags: {},
        });
        created++;
      }
    } catch { continue; }
  }
  return created;
}

async function runCongressSearch(profile: Profile): Promise<number> {
  const searchName = profile.full_name.split(' ').pop() || profile.full_name;
  const params = new URLSearchParams({ query: searchName, sort: 'updateDate+desc', limit: '50', api_key: CONGRESS_API_KEY });
  const res = await fetch(`https://api.congress.gov/v3/bill?${params}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return 0;

  const data = await res.json();
  const bills = data.bills || [];
  let created = 0;

  for (const bill of bills) {
    const sourceUrl = bill.url || `https://www.congress.gov/bill/${bill.congress}/${bill.type?.toLowerCase()}/${bill.number}`;
    const { data: existing } = await supabase.from('analysis_data_items').select('id').eq('profile_id', profile.id).eq('source_url', sourceUrl).limit(1).maybeSingle();
    if (existing) continue;

    const title = `${bill.type || ''}${bill.number || ''}: ${bill.title || 'Untitled'}`;
    const summary = [bill.title, bill.latestAction?.text ? `Latest Action: ${bill.latestAction.text}` : ''].filter(Boolean).join('\n');
    const anomalyFlags = checkAnomalies(profile, title, summary);

    await supabase.from('analysis_data_items').insert({
      profile_id: profile.id, org_id: profile.org_id,
      category: 'bill', title, summary,
      key_topics: bill.policyArea?.name ? [bill.policyArea.name] : [],
      source_url: sourceUrl, source_name: 'congress.gov', source_trust_level: 'trusted',
      item_date: bill.latestAction?.actionDate || null,
      verification_status: anomalyFlags.length > 0 ? 'unverified' : 'verified',
      anomaly_flags: anomalyFlags.length > 0 ? { flags: anomalyFlags } : {},
    });
    created++;
  }
  return created;
}

async function runOpenSecretsSearch(profile: Profile): Promise<number> {
  // Similar to lib version but using worker supabase client
  const searchRes = await fetch(`https://www.opensecrets.org/api/?method=getLegislators&id=${encodeURIComponent(profile.state || 'US')}&apikey=${OPENSECRETS_API_KEY}&output=json`);
  if (!searchRes.ok) return 0;

  const searchData = await searchRes.json();
  const legislators = searchData?.response?.legislator || [];
  const lastName = profile.full_name.split(' ').pop()?.toLowerCase() || '';
  const match = Array.isArray(legislators) ? legislators.find((l: { '@attributes': { firstlast: string } }) => l['@attributes']?.firstlast?.toLowerCase().includes(lastName)) : null;
  if (!match) return 0;

  const cid = match['@attributes']?.cid;
  if (!cid) return 0;

  const summaryRes = await fetch(`https://www.opensecrets.org/api/?method=candSummary&cid=${cid}&apikey=${OPENSECRETS_API_KEY}&output=json`);
  if (!summaryRes.ok) return 0;

  const summaryData = await summaryRes.json();
  const summary = summaryData?.response?.summary?.['@attributes'];
  if (!summary) return 0;

  const sourceUrl = `https://www.opensecrets.org/members-of-congress/summary?cid=${cid}`;
  const { data: existing } = await supabase.from('analysis_data_items').select('id').eq('profile_id', profile.id).eq('source_url', sourceUrl).limit(1).maybeSingle();
  if (existing) return 0;

  await supabase.from('analysis_data_items').insert({
    profile_id: profile.id, org_id: profile.org_id,
    category: 'donation', subcategory: 'campaign_summary',
    title: `Campaign Finance: ${profile.full_name}`,
    summary: `Total raised: $${Number(summary.total || 0).toLocaleString()}. Cash on hand: $${Number(summary.cash_on_hand || 0).toLocaleString()}.`,
    key_topics: ['campaign finance'], source_url: sourceUrl, source_name: 'opensecrets.org',
    source_trust_level: 'trusted', verification_status: 'verified', anomaly_flags: {},
  });
  return 1;
}

async function runCourtListenerSearch(profile: Profile): Promise<number> {
  const res = await fetch(`https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(profile.full_name)}&type=o&order_by=dateFiled+desc&page_size=50`, {
    headers: { Authorization: `Token ${COURTLISTENER_API_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) return 0;

  const data = await res.json();
  const opinions = data.results || [];
  let created = 0;

  for (const op of opinions) {
    const sourceUrl = op.absolute_url ? `https://www.courtlistener.com${op.absolute_url}` : null;
    if (!sourceUrl) continue;
    const { data: existing } = await supabase.from('analysis_data_items').select('id').eq('profile_id', profile.id).eq('source_url', sourceUrl).limit(1).maybeSingle();
    if (existing) continue;

    const title = op.caseName || op.case_name || 'Unnamed Opinion';
    const anomalyFlags = checkAnomalies(profile, title, op.snippet || '');

    await supabase.from('analysis_data_items').insert({
      profile_id: profile.id, org_id: profile.org_id,
      category: 'legal_filing', subcategory: 'opinion', title,
      summary: op.snippet || '', source_url: sourceUrl, source_name: 'courtlistener.com',
      source_trust_level: 'trusted', item_date: op.dateFiled || null,
      verification_status: anomalyFlags.length > 0 ? 'unverified' : 'verified',
      anomaly_flags: anomalyFlags.length > 0 ? { flags: anomalyFlags } : {},
    });
    created++;
  }
  return created;
}

// Simple anomaly detection for the worker
function checkAnomalies(profile: Profile, title: string, summary: string): { type: string; reason: string; score: number }[] {
  const flags: { type: string; reason: string; score: number }[] = [];
  const text = `${title} ${summary}`.toLowerCase();

  const badTerms = ['arrested', 'obituary', 'wedding', 'athlete', 'musician', 'actor', 'singer', 'rapper', 'sports', 'nba', 'nfl'];
  for (const term of badTerms) {
    if (text.includes(term)) {
      flags.push({ type: 'profession_mismatch', reason: `Contains "${term}"`, score: 0.7 });
      break;
    }
  }

  const lastName = profile.full_name.split(' ').pop()?.toLowerCase() || '';
  if (text.length > 50 && !text.includes(lastName)) {
    flags.push({ type: 'name_mismatch', reason: `"${lastName}" not found in text`, score: 0.8 });
  }

  return flags;
}

main().catch(err => {
  log(WORKER, `Fatal error: ${err}`);
  process.exit(1);
});
