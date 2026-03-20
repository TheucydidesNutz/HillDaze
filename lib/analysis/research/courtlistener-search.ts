import { supabaseAdmin } from '@/lib/supabase';
import type { AnalysisProfile } from '../types';
import { checkForAnomalies } from './anomaly-detection';

interface ResearchResult {
  items_created: number;
  errors: string[];
}

export async function searchCourtListener(
  profile: AnalysisProfile,
  orgId: string,
  apiKey: string
): Promise<ResearchResult> {
  if (profile.position_type !== 'jurist') {
    return { items_created: 0, errors: [] };
  }

  const result: ResearchResult = { items_created: 0, errors: [] };

  try {
    // Search opinions by judge name
    const searchName = profile.full_name;
    const res = await fetch(
      `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(searchName)}&type=o&order_by=dateFiled+desc&page_size=50`,
      {
        headers: {
          Authorization: `Token ${apiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      result.errors.push(`CourtListener API returned ${res.status}`);
      return result;
    }

    const data = await res.json();
    const opinions = data.results || [];

    for (const opinion of opinions) {
      const sourceUrl = opinion.absolute_url
        ? `https://www.courtlistener.com${opinion.absolute_url}`
        : null;

      if (!sourceUrl) continue;

      // Check for duplicate
      const { data: existing } = await supabaseAdmin
        .from('analysis_data_items')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('source_url', sourceUrl)
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      const title = opinion.caseName || opinion.case_name || 'Unnamed Opinion';
      const summary = [
        opinion.snippet || '',
        opinion.court ? `Court: ${opinion.court}` : '',
        opinion.judge ? `Judge: ${opinion.judge}` : '',
        opinion.suitNature ? `Nature of suit: ${opinion.suitNature}` : '',
      ].filter(Boolean).join('\n');

      const anomaly = checkForAnomalies(profile, { title, summary });

      await supabaseAdmin.from('analysis_data_items').insert({
        profile_id: profile.id,
        org_id: orgId,
        category: 'legal_filing',
        subcategory: opinion.type === 'combined-results' ? 'opinion' : (opinion.type || 'opinion'),
        title,
        summary,
        key_topics: opinion.suitNature ? [opinion.suitNature] : [],
        source_url: sourceUrl,
        source_name: 'courtlistener.com',
        source_trust_level: 'trusted',
        item_date: opinion.dateFiled || null,
        verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
        anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
      });
      result.items_created++;
    }
  } catch (err) {
    result.errors.push(`CourtListener search failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}
