import Parser from 'rss-parser';
import { supabase, log, getAllActiveOrgs } from './worker-utils';

const parser = new Parser({ timeout: 10000, maxRedirects: 3 });

async function ingestRssForOrg(orgId: string): Promise<number> {
  let added = 0;

  const { data: feeds } = await supabase.from('intel_rss_feed_config').select('*').eq('org_id', orgId).eq('active', true);
  const { data: compSources } = await supabase.from('intel_competitive_sources').select('*').eq('org_id', orgId).eq('active', true);

  const allFeeds = [
    ...(feeds || []).map((f: any) => ({ id: f.id, url: f.feed_url, name: f.feed_name, sourceType: 'rss', table: 'intel_rss_feed_config' })),
    ...(compSources || []).map((s: any) => ({ id: s.id, url: s.url, name: s.name, sourceType: 'competitive', table: 'intel_competitive_sources' })),
  ];

  for (const feed of allFeeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of (parsed.items || []).slice(0, 50)) {
        const sourceUrl = item.link || item.guid || '';
        if (!sourceUrl) continue;
        const { data: existing } = await supabase.from('intel_news_items').select('id').eq('org_id', orgId).eq('source_url', sourceUrl).limit(1).single();
        if (existing) continue;
        await supabase.from('intel_news_items').insert({
          org_id: orgId, source_type: feed.sourceType, source_url: sourceUrl,
          title: item.title || 'Untitled', raw_content: item.contentSnippet || item.content || null,
        });
        added++;
      }
      await supabase.from(feed.table).update({ last_fetched_at: new Date().toISOString() }).eq('id', feed.id);
    } catch (err) {
      log('rss', `Error fetching ${feed.name}: ${err}`);
    }
  }
  return added;
}

async function main() {
  log('rss', 'Starting RSS ingestion');
  const orgs = await getAllActiveOrgs();
  for (const org of orgs) {
    const count = await ingestRssForOrg(org.id);
    log('rss', `${org.name}: ${count} items added`);
  }
  log('rss', 'Done');
}

main().catch(err => { log('rss', `Fatal: ${err}`); process.exit(1); });
