import { getAnthropicClient } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { supabaseAdmin } from '@/lib/supabase';
import type { AnalysisProfile } from '../types';
import { checkForAnomalies } from './anomaly-detection';

interface ResearchResult {
  items_created: number;
  errors: string[];
}

interface SearchResultItem {
  title: string;
  date: string | null;
  source_url: string;
  source_name: string;
  summary: string;
  category: string;
  key_quotes: string[];
}

const SEARCH_QUERIES = [
  // Official website / C-SPAN
  { template: '"{name}" site:c-span.org transcript OR speech', targetCategory: 'speech' },
  { template: '"{name}" site:senate.gov OR site:house.gov speech OR statement OR press', targetCategory: 'speech' },
  // Speeches and testimony
  { template: '"{name}" floor speech transcript', targetCategory: 'speech' },
  { template: '"{name}" committee testimony OR hearing statement', targetCategory: 'speech' },
  { template: '"{name}" commencement speech OR keynote address', targetCategory: 'speech' },
  // Media and interviews
  { template: '"{name}" podcast interview transcript', targetCategory: 'podcast' },
  { template: '"{name}" op-ed OR editorial OR opinion piece', targetCategory: 'news' },
  { template: '"{name}" press conference transcript', targetCategory: 'speech' },
  // Legal (for former prosecutors/AGs)
  { template: '"{name}" amicus brief OR legal filing OR court opinion', targetCategory: 'legal_filing' },
  // Policy positions
  { template: '"{name}" position on climate change OR environment', targetCategory: 'position' },
  { template: '"{name}" position on healthcare OR medicare OR medicaid', targetCategory: 'position' },
  { template: '"{name}" position on economy OR jobs OR taxes', targetCategory: 'position' },
];

export interface WebSearchOptions {
  since?: string | null;
}

export async function searchWeb(
  profile: AnalysisProfile,
  orgId: string,
  options: WebSearchOptions = {}
): Promise<ResearchResult> {
  const result: ResearchResult = { items_created: 0, errors: [] };
  const client = getAnthropicClient();
  const model = 'claude-sonnet-4-20250514';

  // For quick_update, append current year to bias toward recent results
  const yearSuffix = options.since ? ` ${new Date().getFullYear()}` : '';

  for (const searchConfig of SEARCH_QUERIES) {
    const query = searchConfig.template.replace('{name}', profile.full_name) + yearSuffix;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        tools: [{
          type: 'web_search_20260209',
          name: 'web_search',
          max_uses: 10,
        }],
        messages: [{
          role: 'user',
          content: `Search for: ${query}

After searching, return a JSON array of results. Each result must have verifiable source URLs.

Return ONLY a JSON array (no markdown, no code blocks) with this structure:
[
  {
    "title": "exact title of the content",
    "date": "YYYY-MM-DD or null if unknown",
    "source_url": "full URL to the source",
    "source_name": "name of the website/publication",
    "summary": "2-3 sentence summary of what ${profile.full_name} said or did, focusing on their positions and statements",
    "category": "${searchConfig.targetCategory}",
    "key_quotes": ["exact verbatim quotes from ${profile.full_name} if available, empty array if none"]
  }
]

CRITICAL: Only include results that are actually about ${profile.full_name} (${profile.position_type.replace('_', ' ')}${profile.state ? `, ${profile.state}` : ''}${profile.party ? `, ${profile.party}` : ''}). Do NOT include results about different people with similar names. Every source_url must be a real, verifiable URL. If you find no relevant results, return an empty array [].`,
        }],
      });

      // Track usage
      await logApiUsage({
        orgId,
        endpoint: 'analysis_web_search',
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      // Extract text content from response
      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') continue;

      let items: SearchResultItem[] = [];
      try {
        // Try to parse JSON from the response, handling potential markdown wrapping
        let jsonText = textBlock.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        items = JSON.parse(jsonText);
      } catch {
        result.errors.push(`Failed to parse web search results for query: ${query}`);
        continue;
      }

      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (!item.source_url || !item.title) continue;

        // Check for duplicate
        const { data: existing } = await supabaseAdmin
          .from('analysis_data_items')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('source_url', item.source_url)
          .limit(1)
          .maybeSingle();

        if (existing) continue;

        // Determine source trust level from registry
        const trustLevel = await getSourceTrustLevel(orgId, item.source_name, item.source_url);

        const anomaly = checkForAnomalies(profile, {
          title: item.title,
          summary: item.summary,
          source_name: item.source_name,
        });

        await supabaseAdmin.from('analysis_data_items').insert({
          profile_id: profile.id,
          org_id: orgId,
          category: item.category || searchConfig.targetCategory,
          title: item.title,
          summary: item.summary,
          key_quotes: item.key_quotes || [],
          key_topics: [],
          source_url: item.source_url,
          source_name: item.source_name,
          source_trust_level: trustLevel,
          item_date: item.date || null,
          verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
          anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
        });
        result.items_created++;
      }
    } catch (err) {
      result.errors.push(`Web search failed for "${query}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

async function getSourceTrustLevel(orgId: string, sourceName: string, sourceUrl: string): Promise<'trusted' | 'default' | 'ignored'> {
  // Check source registry for this org
  const { data: sources } = await supabaseAdmin
    .from('analysis_source_registry')
    .select('trust_level, source_url, source_name')
    .eq('org_id', orgId);

  if (!sources || sources.length === 0) return 'default';

  // Match by URL domain or source name
  const urlDomain = sourceUrl ? new URL(sourceUrl).hostname.replace('www.', '') : '';

  for (const source of sources) {
    if (source.source_url && urlDomain && source.source_url.includes(urlDomain)) {
      return source.trust_level as 'trusted' | 'default' | 'ignored';
    }
    if (source.source_name.toLowerCase() === sourceName.toLowerCase()) {
      return source.trust_level as 'trusted' | 'default' | 'ignored';
    }
  }

  return 'default';
}
