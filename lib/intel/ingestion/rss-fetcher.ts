import Parser from 'rss-parser';
import { supabaseAdmin } from '@/lib/supabase';
import { delay } from '@/lib/shared/api-utils';
import type { IngestSourceReport } from './congress-gov';

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 3,
});

const FEED_DELAY_MS = 1000;

export async function ingestRssForOrg(orgId: string): Promise<IngestSourceReport> {
  const report: IngestSourceReport = {
    source: 'rss_feeds',
    status: 'success',
    items_found: 0,
    items_ingested: 0,
    errors: 0,
    details: '',
  };

  // Fetch active RSS feeds
  const { data: feeds } = await supabaseAdmin
    .from('intel_rss_feed_config')
    .select('*')
    .eq('org_id', orgId)
    .eq('active', true);

  // Fetch active competitive sources
  const { data: compSources } = await supabaseAdmin
    .from('intel_competitive_sources')
    .select('*')
    .eq('org_id', orgId)
    .eq('active', true);

  const allFeeds = [
    ...(feeds || []).map((f: { id: string; feed_url: string; feed_name: string }) => ({
      id: f.id,
      url: f.feed_url,
      name: f.feed_name,
      sourceType: 'rss',
      table: 'intel_rss_feed_config',
    })),
    ...(compSources || []).map((s: { id: string; url: string; name: string }) => ({
      id: s.id,
      url: s.url,
      name: s.name,
      sourceType: 'competitive',
      table: 'intel_competitive_sources',
    })),
  ];

  let feedsProcessed = 0;
  let feedsFailed = 0;

  // Process feeds SEQUENTIALLY with delays (polite to feed servers)
  for (const feed of allFeeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 50);
      report.items_found += items.length;

      for (const item of items) {
        const sourceUrl = item.link || item.guid || '';
        if (!sourceUrl) continue;

        // Dedup
        const { count } = await supabaseAdmin
          .from('intel_news_items')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('source_url', sourceUrl);

        if (count && count > 0) continue;

        await supabaseAdmin.from('intel_news_items').insert({
          org_id: orgId,
          source_type: feed.sourceType,
          source_url: sourceUrl,
          title: item.title || 'Untitled',
          raw_content: item.contentSnippet || item.content || item.summary || null,
          summary: null,
          relevance_score: null,
        });
        report.items_ingested++;
      }

      // Update last_fetched_at
      await supabaseAdmin
        .from(feed.table)
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', feed.id);

      feedsProcessed++;
    } catch (err) {
      console.error(`[intel/rss] Feed error for ${feed.name} (${feed.url}):`, err instanceof Error ? err.message : err);
      report.errors++;
      feedsFailed++;
      // Error isolation: one broken feed doesn't stop the others
    }

    // Polite delay between feeds
    if (allFeeds.indexOf(feed) < allFeeds.length - 1) {
      await delay(FEED_DELAY_MS);
    }
  }

  report.details = `${feedsProcessed}/${allFeeds.length} feeds processed, ${feedsFailed} failed, ${report.items_ingested} new items`;
  if (feedsFailed > 0 && feedsProcessed > 0) report.status = 'partial';
  if (feedsFailed > 0 && feedsProcessed === 0) report.status = 'failed';

  return report;
}

export async function testFeedUrl(url: string): Promise<{ title: string; date: string | null } | { error: string }> {
  try {
    const parsed = await parser.parseURL(url);
    const firstItem = parsed.items?.[0];
    if (!firstItem) return { error: 'Feed is empty — no items found' };
    return {
      title: firstItem.title || 'Untitled',
      date: firstItem.pubDate || firstItem.isoDate || null,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to parse feed' };
  }
}
