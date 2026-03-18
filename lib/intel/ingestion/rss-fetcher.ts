import Parser from 'rss-parser';
import { supabaseAdmin } from '@/lib/supabase';

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 3,
});

export async function ingestRssForOrg(orgId: string): Promise<number> {
  let itemsAdded = 0;

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

  for (const feed of allFeeds) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of (parsed.items || []).slice(0, 50)) {
        const sourceUrl = item.link || item.guid || '';
        if (!sourceUrl) continue;

        // Dedup
        const { data: existing } = await supabaseAdmin
          .from('intel_news_items')
          .select('id')
          .eq('org_id', orgId)
          .eq('source_url', sourceUrl)
          .limit(1)
          .single();

        if (existing) continue;

        await supabaseAdmin.from('intel_news_items').insert({
          org_id: orgId,
          source_type: feed.sourceType,
          source_url: sourceUrl,
          title: item.title || 'Untitled',
          raw_content: item.contentSnippet || item.content || item.summary || null,
          summary: null,
          relevance_score: null,
        });
        itemsAdded++;
      }

      // Update last_fetched_at
      await supabaseAdmin
        .from(feed.table)
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', feed.id);
    } catch (err) {
      console.error(`RSS fetch error for ${feed.name}:`, err);
    }
  }

  return itemsAdded;
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
