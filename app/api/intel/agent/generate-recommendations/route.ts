import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { gatherGenerationContext } from '@/lib/intel/agent/gather-context';
import { getRecommendationsSystemPrompt } from '@/lib/intel/agent/prompts/generate-recommendations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin.from('intel_article_recommendations').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
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
    system: getRecommendationsSystemPrompt({
      orgName: ctx.orgName,
      soulDoc: ctx.soulDocContent,
      news: ctx.newsText,
      memories: ctx.memoriesText,
      existingRecs: ctx.recsText,
    }),
    userMessage: 'Generate article recommendations based on the current context.',
    model,
    maxTokens: 4096,
  });

  await logApiUsage({ orgId: org_id, endpoint: 'generate_recommendations', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  let pitches: unknown[];
  try {
    pitches = JSON.parse(result.text);
    if (!Array.isArray(pitches)) pitches = [];
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: result.text }, { status: 500 });
  }

  const inserted = [];
  for (const p of pitches as Record<string, unknown>[]) {
    const { data } = await supabaseAdmin.from('intel_article_recommendations').insert({
      org_id,
      title: p.title,
      thesis: p.thesis,
      key_arguments: p.key_arguments,
      article_type: p.article_type,
      relevance_score: p.relevance_score,
      source_items: p.source_items,
      timeliness: p.timeliness,
      status: 'pitched',
    }).select().single();
    if (data) inserted.push(data);
  }

  return NextResponse.json(inserted, { status: 201 });
}
