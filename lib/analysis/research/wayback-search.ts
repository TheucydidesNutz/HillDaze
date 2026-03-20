import { supabaseAdmin } from '@/lib/supabase';
import type { AnalysisProfile } from '../types';
import { checkForAnomalies } from './anomaly-detection';

interface ResearchResult {
  items_created: number;
  errors: string[];
}

export async function searchWaybackMachine(
  profile: AnalysisProfile,
  orgId: string
): Promise<ResearchResult> {
  const result: ResearchResult = { items_created: 0, errors: [] };

  // Search for archived Twitter/X profiles
  // Try common handle patterns based on name
  const nameParts = profile.full_name.toLowerCase().split(' ');
  const possibleHandles = [
    nameParts.join(''),           // "johndoe"
    nameParts.join('_'),          // "john_doe"
    `${nameParts[0][0]}${nameParts[nameParts.length - 1]}`, // "jdoe"
    `rep${nameParts[nameParts.length - 1]}`,  // "repdoe"
    `sen${nameParts[nameParts.length - 1]}`,  // "sendoe"
  ];

  for (const handle of possibleHandles) {
    try {
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=twitter.com/${handle}&output=json&limit=5&fl=timestamp,original&filter=statuscode:200`;

      const res = await fetch(cdxUrl);
      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data) || data.length <= 1) continue; // First row is headers

      // Skip header row
      for (let i = 1; i < data.length; i++) {
        const [timestamp, originalUrl] = data[i] as [string, string];
        const archiveUrl = `https://web.archive.org/web/${timestamp}/${originalUrl}`;

        // Check for duplicate
        const { data: existing } = await supabaseAdmin
          .from('analysis_data_items')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('source_url', archiveUrl)
          .limit(1)
          .maybeSingle();

        if (existing) continue;

        const date = `${timestamp.slice(0,4)}-${timestamp.slice(4,6)}-${timestamp.slice(6,8)}`;

        const anomaly = checkForAnomalies(profile, {
          title: `Archived Twitter/X Profile: @${handle}`,
          summary: `Wayback Machine snapshot of Twitter/X profile @${handle}`,
        });

        await supabaseAdmin.from('analysis_data_items').insert({
          profile_id: profile.id,
          org_id: orgId,
          category: 'social_media',
          subcategory: 'twitter_archive',
          title: `Archived Twitter/X: @${handle} (${date})`,
          summary: `Wayback Machine snapshot of Twitter/X profile @${handle} from ${date}. Visit the archive URL to view the original content.`,
          source_url: archiveUrl,
          source_name: 'web.archive.org',
          source_trust_level: 'default',
          item_date: date,
          verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
          anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
        });
        result.items_created++;
      }
    } catch (err) {
      // Silently skip failed handle searches — they're speculative
      continue;
    }
  }

  return result;
}
