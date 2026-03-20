import { supabaseAdmin } from '@/lib/supabase';
import type { AnalysisProfile } from '../types';
import { checkForAnomalies } from './anomaly-detection';

interface ResearchResult {
  items_created: number;
  errors: string[];
}

export async function searchOpenSecrets(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string
): Promise<ResearchResult> {
  const result: ResearchResult = { items_created: 0, errors: [] };

  try {
    // OpenSecrets API — get candidate summary (contributions received)
    // First need to find the CID for this candidate
    const searchName = profile.full_name;
    const searchRes = await fetch(
      `https://www.opensecrets.org/api/?method=getLegislators&id=${encodeURIComponent(profile.state || 'US')}&apikey=${apiKey}&output=json`
    );

    if (!searchRes.ok) {
      result.errors.push(`OpenSecrets API returned ${searchRes.status}`);
      return result;
    }

    const searchData = await searchRes.json();
    const legislators = searchData?.response?.legislator || [];

    // Find matching legislator
    const lastName = profile.full_name.split(' ').pop()?.toLowerCase() || '';
    const match = Array.isArray(legislators)
      ? legislators.find((l: { '@attributes': { firstlast: string } }) =>
          l['@attributes']?.firstlast?.toLowerCase().includes(lastName)
        )
      : null;

    if (!match) {
      result.errors.push('No matching legislator found in OpenSecrets');
      return result;
    }

    const cid = match['@attributes']?.cid;
    if (!cid) return result;

    // Get candidate summary
    const summaryRes = await fetch(
      `https://www.opensecrets.org/api/?method=candSummary&cid=${cid}&apikey=${apiKey}&output=json`
    );

    if (summaryRes.ok) {
      const summaryData = await summaryRes.json();
      const summary = summaryData?.response?.summary?.['@attributes'];

      if (summary) {
        const sourceUrl = `https://www.opensecrets.org/members-of-congress/summary?cid=${cid}`;

        const { data: existing } = await supabaseAdmin
          .from('analysis_data_items')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('source_url', sourceUrl)
          .limit(1)
          .maybeSingle();

        if (!existing) {
          const donationSummary = `Total raised: $${Number(summary.total || 0).toLocaleString()}. Cash on hand: $${Number(summary.cash_on_hand || 0).toLocaleString()}. Debt: $${Number(summary.debt || 0).toLocaleString()}. Cycle: ${summary.cycle || 'Unknown'}.`;

          const anomaly = checkForAnomalies(profile, {
            title: `Campaign Finance Summary: ${profile.full_name}`,
            summary: donationSummary
          });

          await supabaseAdmin.from('analysis_data_items').insert({
            profile_id: profile.id,
            org_id: orgId,
            category: 'donation',
            subcategory: 'campaign_summary',
            title: `Campaign Finance Summary: ${profile.full_name} (${summary.cycle || 'recent'})`,
            summary: donationSummary,
            key_topics: ['campaign finance', 'fundraising', 'donations'],
            source_url: sourceUrl,
            source_name: 'opensecrets.org',
            source_trust_level: 'trusted',
            item_date: summary.last_updated || null,
            verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
            anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
          });
          result.items_created++;
        }
      }
    }

    // Get top contributors by sector
    const sectorRes = await fetch(
      `https://www.opensecrets.org/api/?method=candSector&cid=${cid}&apikey=${apiKey}&output=json`
    );

    if (sectorRes.ok) {
      const sectorData = await sectorRes.json();
      const sectors = sectorData?.response?.sectors?.sector || [];

      if (Array.isArray(sectors) && sectors.length > 0) {
        const sourceUrl = `https://www.opensecrets.org/members-of-congress/industries?cid=${cid}`;

        const { data: existing } = await supabaseAdmin
          .from('analysis_data_items')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('source_url', sourceUrl)
          .limit(1)
          .maybeSingle();

        if (!existing) {
          const topSectors = sectors
            .slice(0, 10)
            .map((s: { '@attributes': { sector_name: string; total: string } }) => {
              const a = s['@attributes'];
              return `${a.sector_name}: $${Number(a.total || 0).toLocaleString()}`;
            });

          await supabaseAdmin.from('analysis_data_items').insert({
            profile_id: profile.id,
            org_id: orgId,
            category: 'donation',
            subcategory: 'sector_breakdown',
            title: `Donor Sectors: ${profile.full_name}`,
            summary: `Top contributing sectors:\n${topSectors.join('\n')}`,
            key_topics: ['campaign finance', 'donor sectors', 'industry contributions'],
            source_url: sourceUrl,
            source_name: 'opensecrets.org',
            source_trust_level: 'trusted',
            verification_status: 'verified',
            anomaly_flags: {},
          });
          result.items_created++;
        }
      }
    }
  } catch (err) {
    result.errors.push(`OpenSecrets search failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}
