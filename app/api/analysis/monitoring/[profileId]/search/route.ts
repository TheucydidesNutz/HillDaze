import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';
import { getAnthropicClient } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { checkForAnomalies } from '@/lib/analysis/research/anomaly-detection';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { profileId } = await params;
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member || member.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { query } = body;
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

  const client = getAnthropicClient();
  const model = 'claude-sonnet-4-20250514';

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 5 }],
      messages: [{
        role: 'user',
        content: `Search for: "${profile.full_name}" ${query}

Return ONLY a JSON array of results. Each must have a verifiable source URL and be specifically about ${profile.full_name}.

[{"title":"...","date":"YYYY-MM-DD or null","source_url":"...","source_name":"...","summary":"...","category":"speech|news|position|podcast|social_media","key_quotes":["..."]}]

If no results found, return [].`,
      }],
    });

    await logApiUsage({
      orgId: profile.org_id,
      endpoint: 'analysis_adhoc_search',
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ items_created: 0, results: [] });
    }

    let items: Array<{ title: string; date: string | null; source_url: string; source_name: string; summary: string; category: string; key_quotes: string[] }> = [];
    try {
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      items = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ items_created: 0, results: [], error: 'Failed to parse search results' });
    }

    if (!Array.isArray(items)) return NextResponse.json({ items_created: 0, results: [] });

    const created: string[] = [];

    for (const item of items) {
      if (!item.source_url || !item.title) continue;

      // Deduplicate
      const { data: existing } = await supabaseAdmin
        .from('analysis_data_items')
        .select('id')
        .eq('profile_id', profileId)
        .eq('source_url', item.source_url)
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      const anomaly = checkForAnomalies(profile, { title: item.title, summary: item.summary });

      const { data: newItem } = await supabaseAdmin
        .from('analysis_data_items')
        .insert({
          profile_id: profileId,
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
          verification_status: anomaly.isAnomaly ? 'unverified' : 'verified',
          anomaly_flags: anomaly.isAnomaly ? { flags: anomaly.flags } : {},
        })
        .select('id')
        .single();

      if (newItem) created.push(newItem.id);
    }

    return NextResponse.json({
      items_created: created.length,
      results: items.slice(0, 10),
      new_item_ids: created,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 });
  }
}
