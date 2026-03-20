import { NextRequest } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';
import { getAnthropicClient } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { checkForAnomalies } from '@/lib/analysis/research/anomaly-detection';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { id: profileId } = await params;
  const profile = await getProfile(profileId);
  if (!profile) return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member || member.role === 'viewer') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const body = await request.json();
  const { mode, urls, domain, category, depth } = body as {
    mode: 'urls' | 'domain' | 'category';
    urls?: string[];
    domain?: string;
    category?: string;
    depth?: number;
  };

  const client = getAnthropicClient();
  const model = 'claude-sonnet-4-20250514';

  // Stream progress via SSE
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      function sendEvent(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      let totalCreated = 0;
      let totalProcessed = 0;
      let totalFound = 0;

      try {
        if (mode === 'urls' && urls && urls.length > 0) {
          // Mode 1: Scrape specific URLs
          totalFound = urls.length;
          sendEvent({ type: 'progress', message: `Processing ${urls.length} URLs...`, found: totalFound, processed: 0, created: 0 });

          for (const url of urls) {
            totalProcessed++;
            if (await isDuplicate(profile.id, url)) {
              sendEvent({ type: 'progress', message: `Skipped (duplicate): ${url}`, found: totalFound, processed: totalProcessed, created: totalCreated });
              continue;
            }

            try {
              // Use Claude to fetch and summarize the URL
              const response = await client.messages.create({
                model,
                max_tokens: 4096,
                tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 3 }],
                messages: [{
                  role: 'user',
                  content: `Fetch and analyze this URL: ${url}

This is a document related to ${profile.full_name}. Extract and return ONLY a JSON object (no markdown):
{
  "title": "exact title of the page/document",
  "date": "YYYY-MM-DD or null",
  "summary": "comprehensive summary focusing on ${profile.full_name}'s positions, statements, or actions",
  "category": "speech|news|position|legal_filing|podcast|social_media",
  "key_quotes": ["exact verbatim quotes from ${profile.full_name}"],
  "key_topics": ["topic1", "topic2"],
  "full_text": "the complete text content of the page (first 50000 chars)"
}

If you cannot access the URL, return {"error": "cannot access"}.`
                }],
              });

              await logApiUsage({ orgId: profile.org_id, endpoint: 'analysis_deep_research_url', model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });

              const textBlock = response.content.find(b => b.type === 'text');
              if (!textBlock || textBlock.type !== 'text') continue;

              let parsed: Record<string, unknown>;
              try {
                let t = textBlock.text.trim();
                if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                parsed = JSON.parse(t);
              } catch { continue; }

              if (parsed.error) {
                sendEvent({ type: 'progress', message: `Could not access: ${url}`, found: totalFound, processed: totalProcessed, created: totalCreated });
                continue;
              }

              const anomaly = checkForAnomalies(profile, { title: parsed.title as string, summary: parsed.summary as string });

              await supabaseAdmin.from('analysis_data_items').insert({
                profile_id: profile.id,
                org_id: profile.org_id,
                category: (parsed.category as string) || 'news',
                title: (parsed.title as string) || url,
                full_text: (parsed.full_text as string) || null,
                summary: (parsed.summary as string) || null,
                key_quotes: (parsed.key_quotes as string[]) || [],
                key_topics: (parsed.key_topics as string[]) || [],
                source_url: url,
                source_name: new URL(url).hostname.replace('www.', ''),
                source_trust_level: 'default',
                item_date: (parsed.date as string) || null,
                storage_tier: 'deep_dive',
                verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
                anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
              });
              totalCreated++;
              sendEvent({ type: 'progress', message: `Ingested: ${parsed.title || url}`, found: totalFound, processed: totalProcessed, created: totalCreated });
            } catch (err) {
              sendEvent({ type: 'progress', message: `Error on ${url}: ${err instanceof Error ? err.message : 'unknown'}`, found: totalFound, processed: totalProcessed, created: totalCreated });
            }
          }

        } else if (mode === 'domain' && domain) {
          // Mode 2: Crawl a domain — use Claude to discover pages
          sendEvent({ type: 'progress', message: `Discovering pages on ${domain}...`, found: 0, processed: 0, created: 0 });

          const maxPages = Math.min(depth || 20, 50);

          const discoverResponse = await client.messages.create({
            model,
            max_tokens: 4096,
            tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 10 }],
            messages: [{
              role: 'user',
              content: `Search the website ${domain} for pages related to ${profile.full_name}. Look for:
- Speeches, press releases, and statements
- News and media pages
- Policy positions
- Committee work

Search for: site:${domain} ${profile.full_name}
Also check common paths like: ${domain}/news, ${domain}/newsroom, ${domain}/speeches, ${domain}/press-releases, ${domain}/issues

Return ONLY a JSON array of up to ${maxPages} URLs that contain relevant content about ${profile.full_name}:
["https://${domain}/path1", "https://${domain}/path2", ...]

If you can't find any relevant pages, return [].`
            }],
          });

          await logApiUsage({ orgId: profile.org_id, endpoint: 'analysis_deep_research_discover', model, inputTokens: discoverResponse.usage.input_tokens, outputTokens: discoverResponse.usage.output_tokens });

          const discoverText = discoverResponse.content.find(b => b.type === 'text');
          let discoveredUrls: string[] = [];
          if (discoverText && discoverText.type === 'text') {
            try {
              let t = discoverText.text.trim();
              if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
              discoveredUrls = JSON.parse(t);
            } catch { /* empty */ }
          }

          if (!Array.isArray(discoveredUrls)) discoveredUrls = [];
          totalFound = discoveredUrls.length;
          sendEvent({ type: 'progress', message: `Found ${totalFound} pages on ${domain}`, found: totalFound, processed: 0, created: 0 });

          // Now process each discovered URL (same as urls mode)
          for (const url of discoveredUrls) {
            totalProcessed++;
            if (await isDuplicate(profile.id, url)) {
              sendEvent({ type: 'progress', message: `Skipped (duplicate): ${url}`, found: totalFound, processed: totalProcessed, created: totalCreated });
              continue;
            }

            try {
              const response = await client.messages.create({
                model,
                max_tokens: 4096,
                tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 3 }],
                messages: [{
                  role: 'user',
                  content: `Fetch and analyze: ${url}\n\nExtract content about ${profile.full_name}. Return ONLY JSON:\n{"title":"...","date":"YYYY-MM-DD or null","summary":"...","category":"speech|news|position|legal_filing","key_quotes":["..."],"key_topics":["..."],"full_text":"first 50000 chars of content"}\n\nReturn {"error":"cannot access"} if inaccessible.`
                }],
              });

              await logApiUsage({ orgId: profile.org_id, endpoint: 'analysis_deep_research_page', model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });

              const textBlock = response.content.find(b => b.type === 'text');
              if (!textBlock || textBlock.type !== 'text') continue;

              let parsed: Record<string, unknown>;
              try {
                let t = textBlock.text.trim();
                if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                parsed = JSON.parse(t);
              } catch { continue; }

              if (parsed.error) continue;

              const anomaly = checkForAnomalies(profile, { title: parsed.title as string, summary: parsed.summary as string });

              await supabaseAdmin.from('analysis_data_items').insert({
                profile_id: profile.id,
                org_id: profile.org_id,
                category: (parsed.category as string) || 'news',
                title: (parsed.title as string) || url,
                full_text: (parsed.full_text as string) || null,
                summary: (parsed.summary as string) || null,
                key_quotes: (parsed.key_quotes as string[]) || [],
                key_topics: (parsed.key_topics as string[]) || [],
                source_url: url,
                source_name: domain,
                source_trust_level: 'default',
                item_date: (parsed.date as string) || null,
                storage_tier: 'deep_dive',
                verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
                anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
              });
              totalCreated++;
              sendEvent({ type: 'progress', message: `Ingested: ${parsed.title || url}`, found: totalFound, processed: totalProcessed, created: totalCreated });
            } catch {
              sendEvent({ type: 'progress', message: `Error processing ${url}`, found: totalFound, processed: totalProcessed, created: totalCreated });
            }
          }

        } else if (mode === 'category' && category) {
          // Mode 3: Focused category search
          const categoryQueries: Record<string, string[]> = {
            speech: [
              `"${profile.full_name}" speech transcript full text`,
              `"${profile.full_name}" floor speech senate OR house`,
              `"${profile.full_name}" site:c-span.org`,
              `"${profile.full_name}" commencement OR keynote address`,
            ],
            legal_filing: [
              `"${profile.full_name}" amicus brief`,
              `"${profile.full_name}" legal opinion OR court filing`,
              `"${profile.full_name}" attorney general opinion`,
              `"${profile.full_name}" site:courtlistener.com OR site:law.justia.com`,
            ],
            podcast: [
              `"${profile.full_name}" podcast interview`,
              `"${profile.full_name}" podcast episode transcript`,
              `"${profile.full_name}" radio interview`,
            ],
            news: [
              `"${profile.full_name}" op-ed OR editorial`,
              `"${profile.full_name}" interview transcript`,
              `"${profile.full_name}" press conference`,
            ],
            position: [
              `"${profile.full_name}" position on climate`,
              `"${profile.full_name}" position on healthcare`,
              `"${profile.full_name}" position on economy OR jobs`,
              `"${profile.full_name}" policy proposal`,
            ],
          };

          const queries = categoryQueries[category] || [`"${profile.full_name}" ${category}`];
          totalFound = queries.length;
          sendEvent({ type: 'progress', message: `Running ${queries.length} targeted searches for ${category}...`, found: totalFound, processed: 0, created: 0 });

          for (const query of queries) {
            totalProcessed++;
            try {
              const response = await client.messages.create({
                model,
                max_tokens: 4096,
                tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 10 }],
                messages: [{
                  role: 'user',
                  content: `Search for: ${query}\n\nReturn ONLY a JSON array of results about ${profile.full_name}:\n[{"title":"...","date":"YYYY-MM-DD or null","source_url":"...","source_name":"...","summary":"...","category":"${category}","key_quotes":["..."]}]\n\nReturn [] if nothing found.`
                }],
              });

              await logApiUsage({ orgId: profile.org_id, endpoint: `analysis_deep_research_${category}`, model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });

              const textBlock = response.content.find(b => b.type === 'text');
              if (!textBlock || textBlock.type !== 'text') continue;

              let items: Array<{ title: string; date: string | null; source_url: string; source_name: string; summary: string; category: string; key_quotes: string[] }> = [];
              try {
                let t = textBlock.text.trim();
                if (t.startsWith('```')) t = t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                items = JSON.parse(t);
              } catch { continue; }

              if (!Array.isArray(items)) continue;

              for (const item of items) {
                if (!item.source_url || !item.title) continue;
                if (await isDuplicate(profile.id, item.source_url)) continue;

                const anomaly = checkForAnomalies(profile, { title: item.title, summary: item.summary });

                await supabaseAdmin.from('analysis_data_items').insert({
                  profile_id: profile.id,
                  org_id: profile.org_id,
                  category: item.category || category,
                  title: item.title,
                  summary: item.summary,
                  key_quotes: item.key_quotes || [],
                  key_topics: [],
                  source_url: item.source_url,
                  source_name: item.source_name,
                  source_trust_level: 'default',
                  item_date: item.date || null,
                  verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
                  anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
                });
                totalCreated++;
              }

              sendEvent({ type: 'progress', message: `Search "${query.substring(0, 60)}": found ${items.length} results`, found: totalFound, processed: totalProcessed, created: totalCreated });
            } catch (err) {
              sendEvent({ type: 'progress', message: `Search failed: ${err instanceof Error ? err.message : 'unknown'}`, found: totalFound, processed: totalProcessed, created: totalCreated });
            }
          }
        }

        // Auto-regenerate soul document if enough new items were added
        if (totalCreated >= 10) {
          sendEvent({ type: 'progress', message: 'Triggering soul document regeneration...', found: totalFound, processed: totalProcessed, created: totalCreated });
          try {
            const { generateSoulDocument } = await import('@/lib/analysis/agent/generate-soul-document');
            await generateSoulDocument(profile, profile.org_id);
            sendEvent({ type: 'progress', message: 'Soul document regenerated.', found: totalFound, processed: totalProcessed, created: totalCreated });
          } catch (err) {
            sendEvent({ type: 'progress', message: `Soul doc regen failed: ${err instanceof Error ? err.message : 'unknown'}`, found: totalFound, processed: totalProcessed, created: totalCreated });
          }
        }

        sendEvent({ type: 'complete', total_created: totalCreated, total_found: totalFound, total_processed: totalProcessed });
      } catch (err) {
        sendEvent({ type: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
