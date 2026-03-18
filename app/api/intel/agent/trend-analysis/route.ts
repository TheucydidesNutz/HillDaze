import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { gatherGenerationContext } from '@/lib/intel/agent/gather-context';
import { getTrendAnalysisSystemPrompt } from '@/lib/intel/agent/prompts/trend-analysis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data } = await supabaseAdmin.from('intel_trend_reports').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id } = await request.json();
  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ctx = await gatherGenerationContext(org_id);
  const model = 'claude-sonnet-4-20250514';

  const result = await callClaude({
    system: getTrendAnalysisSystemPrompt({
      orgName: ctx.orgName,
      soulDoc: ctx.soulDocContent,
      news: ctx.newsText,
      stakeholders: ctx.stakeholderText,
      memories: ctx.memoriesText,
    }),
    userMessage: 'Analyze current trends relevant to this organization.',
    model,
    maxTokens: 4096,
  });

  await logApiUsage({ orgId: org_id, endpoint: 'trend_analysis', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  let trends: unknown[];
  try {
    trends = JSON.parse(result.text);
    if (!Array.isArray(trends)) trends = [];
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: result.text }, { status: 500 });
  }

  const inserted = [];
  for (const t of trends as Record<string, unknown>[]) {
    const { data } = await supabaseAdmin.from('intel_trend_reports').insert({
      org_id,
      title: t.title,
      summary: t.summary,
      detail: t.detail,
      trend_type: t.trend_type,
      jurisdictions: t.jurisdictions,
      key_actors: t.key_actors,
      implications: t.implications,
      recommended_response: t.recommended_response,
      source_items: t.source_items,
    }).select().single();
    if (data) inserted.push(data);

    // Update stakeholders with key actors
    const actors = (t.key_actors || []) as { name: string; role: string; organization: string }[];
    for (const actor of actors) {
      if (!actor.name) continue;
      const { data: existing } = await supabaseAdmin.from('intel_stakeholders')
        .select('id, mention_count').eq('org_id', org_id).eq('name', actor.name).limit(1).single();
      if (existing) {
        await supabaseAdmin.from('intel_stakeholders').update({
          mention_count: existing.mention_count + 1,
          last_mentioned_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabaseAdmin.from('intel_stakeholders').insert({
          org_id,
          name: actor.name,
          title: actor.role,
          organization: actor.organization,
          role_type: 'policy_actor',
          mention_count: 1,
          last_mentioned_at: new Date().toISOString(),
          mention_sources: [],
        });
      }
    }
  }

  return NextResponse.json(inserted, { status: 201 });
}
