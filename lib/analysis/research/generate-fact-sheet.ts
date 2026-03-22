import { supabaseAdmin } from '@/lib/supabase';
import { getProfile } from '../supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { fetchWithRetry, delay } from '@/lib/shared/api-utils';
import { getOrgApiKey } from '@/lib/shared/org-api-keys';

const CONGRESS_BASE = 'https://api.congress.gov/v3';

export async function generateFactSheet(profileId: string): Promise<Record<string, unknown>> {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error(`Profile ${profileId} not found`);

  const sourcesUsed: string[] = [];

  // ── Layer 1: Congress.gov structured data ─────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let congressData: Record<string, any> = {};
  const externalIds = ((profile as unknown as Record<string, unknown>).external_ids || {}) as Record<string, string>;
  const bioguideId = externalIds.bioguide;
  const congressApiKey = await getOrgApiKey(profile.org_id, 'congress_gov') || process.env.CONGRESS_API_KEY || '';

  if (bioguideId && congressApiKey) {
    try {
      const memberResp = await fetchWithRetry(
        `${CONGRESS_BASE}/member/${bioguideId}?api_key=${congressApiKey}&format=json`
      );

      if (memberResp?.member) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = memberResp.member as any;
        const terms = (m.terms || []) as Array<Record<string, unknown>>;
        const latestTerm = terms[terms.length - 1] || {};
        const earliestTerm = terms[0] || {};
        const startYear = earliestTerm.startYear || (typeof earliestTerm.startDate === 'string' ? earliestTerm.startDate.slice(0, 4) : null);
        const yearsServing = startYear ? new Date().getFullYear() - Number(startYear) : undefined;

        congressData = {
          state: m.state || profile.state,
          district: m.district || profile.district,
          party: m.partyName || profile.party,
          chamber: latestTerm.chamber || (terms.some((t: Record<string, unknown>) => t.chamber === 'Senate') ? 'Senate' : 'House'),
          current_role: `U.S. ${latestTerm.chamber === 'Senate' ? 'Senator' : 'Representative'} from ${m.state || profile.state || 'unknown'}`,
          years_serving: yearsServing,
          service_start_date: typeof earliestTerm.startDate === 'string' ? earliestTerm.startDate : (startYear ? `${startYear}` : undefined),
          website_official: m.officialWebsiteUrl || m.url || undefined,
          office_address: m.addressInformation?.officeAddress || undefined,
          office_phone: m.addressInformation?.phoneNumber || undefined,
        };
        sourcesUsed.push('congress.gov/member');
      }

      await delay(1000);

      // Current session sponsored legislation (119th Congress only)
      const billsResp = await fetchWithRetry(
        `${CONGRESS_BASE}/member/${bioguideId}/sponsored-legislation?congress=119&limit=50&api_key=${congressApiKey}&format=json`
      );

      if (billsResp?.sponsoredLegislation) {
        const allItems = billsResp.sponsoredLegislation as Array<Record<string, unknown>>;

        // Separate bills from amendments based on the API URL structure
        // Amendments: url contains "/amendment/", have `amendmentNumber` field, type is null
        // Bills: url contains "/bill/", have `number` and `type` fields
        const bills: Array<Record<string, unknown>> = [];
        const amendments: string[] = [];

        for (const b of allItems) {
          const apiUrl = String(b.url || '');
          const congress = Number(b.congress || 0);
          if (congress && congress !== 119) continue;

          if (apiUrl.includes('/amendment/')) {
            // Extract amendment type+number from URL: .../amendment/119/samdt/4451
            const match = apiUrl.match(/\/amendment\/\d+\/(\w+)\/(\d+)/);
            if (match) {
              amendments.push(`${match[1].toUpperCase()} ${match[2]}`);
            } else {
              const num = b.amendmentNumber || b.number || '';
              if (num) amendments.push(`AMDT ${num}`);
            }
          } else {
            bills.push(b);
          }
        }

        congressData.bills_sponsored_current_session = bills.map(b => ({
          number: `${String(b.type || '').toUpperCase()}. ${b.number || ''}`.trim(),
          title: b.title || b.latestTitle || 'Untitled',
          status: (b.latestAction as Record<string, string>)?.text || 'Introduced',
          url: (b.url as string)?.replace('api.congress.gov/v3', 'congress.gov') || null,
          date: (b.latestAction as Record<string, string>)?.actionDate || (b.introducedDate as string) || null,
        }));

        if (amendments.length > 0) {
          congressData.amendments_current_session = amendments;
        }

        sourcesUsed.push('congress.gov/legislation');
      }
    } catch (err) {
      console.error('[fact-sheet] Congress.gov error:', err);
    }
  }

  // ── Layer 2: Claude extraction from data lake ────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let claudeData: Record<string, any> = {};

  try {
    const { data: items } = await supabaseAdmin
      .from('analysis_data_items')
      .select('title, summary, key_quotes, category, source_name, source_url')
      .eq('profile_id', profileId)
      .in('category', ['news', 'speech', 'position', 'donation', 'uploaded_doc', 'podcast'])
      .order('item_date', { ascending: false })
      .limit(20);

    const { data: soulDoc } = await supabaseAdmin
      .from('analysis_soul_documents')
      .select('content')
      .eq('profile_id', profileId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const sourceTexts = (items || []).map(item =>
      `[${item.category}] ${item.title}\n${item.summary || ''}\n${(item.key_quotes || []).join('\n')}`
    ).join('\n\n---\n\n');

    const soulContent = soulDoc?.content
      ? `\n\nSoul Document excerpts:\n${JSON.stringify(soulDoc.content, null, 2).slice(0, 3000)}`
      : '';

    if (sourceTexts.length > 50) {
      const model = 'claude-sonnet-4-20250514';
      const result = await callClaude({
        system: `You are extracting structured biographical information about ${profile.full_name} from source documents. Return ONLY valid JSON matching the schema below. If information is not available in the sources, use null — do NOT guess or hallucinate.`,
        userMessage: `Extract the following about ${profile.full_name} (${profile.position_type}, ${profile.state || 'unknown state'}):

{
  "short_bio": "3-4 sentence biography",
  "religion": "religious affiliation or null",
  "education": ["degree and institution", ...],
  "cv_bullets": ["career history as bullet points", ...],
  "caucuses": ["caucus memberships", ...],
  "board_seats": ["non-governmental advisory roles", ...],
  "website_campaign": "campaign website URL or null",
  "pac_affiliations": ["PAC names", ...],
  "top_donors": ["top 5 donor industries/names", ...]
}

Sources:
${sourceTexts.slice(0, 8000)}${soulContent}`,
        model,
        maxTokens: 2048,
      });

      await logApiUsage({
        orgId: profile.org_id,
        endpoint: 'analysis_fact_sheet',
        model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      try {
        let text = result.text.trim();
        if (text.startsWith('```')) text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        claudeData = JSON.parse(text);
        sourcesUsed.push('claude_extraction');
      } catch {
        claudeData = {};
      }
    }
  } catch (err) {
    console.error('[fact-sheet] Claude extraction error:', err);
  }

  // ── Merge: Congress.gov wins on shared fields ─────────────────
  const factSheet = {
    ...claudeData,
    ...congressData,
    generated_at: new Date().toISOString(),
    sources_used: sourcesUsed,
  };

  // Store
  try {
    await supabaseAdmin
      .from('analysis_profiles')
      .update({
        fact_sheet: factSheet,
        fact_sheet_generated_at: new Date().toISOString(),
      })
      .eq('id', profileId);
  } catch {
    // Columns may not exist yet
  }

  return factSheet;
}
