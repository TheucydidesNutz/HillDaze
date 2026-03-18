import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { gatherGenerationContext } from '@/lib/intel/agent/gather-context';
import { getStrategicReviewSystemPrompt } from '@/lib/intel/agent/prompts/strategic-review';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data } = await supabaseAdmin.from('intel_strategic_recommendations').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
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
    system: getStrategicReviewSystemPrompt({
      orgName: ctx.orgName,
      soulDoc: ctx.soulDocContent,
      news: ctx.newsText,
      calendar: ctx.calendarText,
      stakeholders: ctx.stakeholderText,
      memories: ctx.memoriesText,
      recommendations: ctx.recsText,
    }),
    userMessage: 'Generate strategic action recommendations.',
    model,
    maxTokens: 4096,
  });

  await logApiUsage({ orgId: org_id, endpoint: 'strategic_review', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  let recs: unknown[];
  try {
    recs = JSON.parse(result.text);
    if (!Array.isArray(recs)) recs = [];
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: result.text }, { status: 500 });
  }

  const inserted = [];
  for (const r of recs as Record<string, unknown>[]) {
    const { data } = await supabaseAdmin.from('intel_strategic_recommendations').insert({
      org_id,
      recommendation_type: r.recommendation_type,
      title: r.title,
      description: r.description,
      action_steps: r.action_steps,
      deadline: r.deadline || null,
      priority: r.priority,
      rationale: r.rationale,
      related_stakeholders: r.related_stakeholders,
      related_calendar_events: r.related_calendar_events,
      status: 'new',
    }).select().single();
    if (data) inserted.push(data);
  }

  return NextResponse.json(inserted, { status: 201 });
}
