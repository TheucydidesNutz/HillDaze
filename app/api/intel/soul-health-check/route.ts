import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { gatherGenerationContext } from '@/lib/intel/agent/gather-context';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('intel_soul_health_checks')
    .select('*')
    .eq('org_id', orgId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id } = await request.json();
  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ctx = await gatherGenerationContext(org_id);
  const model = 'claude-sonnet-4-20250514';

  const result = await callClaude({
    system: `You are analyzing alignment between an organization's soul document and its actual activity over the last 60 days.

Soul document:
${ctx.soulDocContent}

Recent news items tracked:
${ctx.newsText}

Agent memories (conversation topics):
${ctx.memoriesText}

Document library:
${ctx.docSummaries}

Stakeholder activity:
${ctx.stakeholderText}

Research targets:
${ctx.recsText}

Analyze alignment and return a JSON object:
{
  "dormant_topics": [{"topic": "topic name", "explanation": "why it's dormant"}],
  "unstated_topics": [{"topic": "topic name", "explanation": "high activity but not in soul doc"}],
  "priority_mismatches": [{"topic": "topic name", "stated_priority": 1, "actual_engagement": "low|medium|high", "explanation": "..."}],
  "objective_progress": [{"objective": "objective text", "progress": "on_track|behind|stalled|completed", "assessment": "..."}],
  "overall_health_score": 0.75,
  "narrative": "2-3 paragraph written assessment of overall alignment"
}

Return ONLY valid JSON. No markdown.`,
    userMessage: 'Perform the soul document health check.',
    model,
    maxTokens: 4096,
  });

  await logApiUsage({ orgId: org_id, endpoint: 'soul_health_check', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  let parsed;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin.from('intel_soul_health_checks').insert({
    org_id,
    check_period: '60 days',
    dormant_topics: parsed.dormant_topics || [],
    unstated_topics: parsed.unstated_topics || [],
    priority_mismatches: parsed.priority_mismatches || [],
    objective_progress: parsed.objective_progress || [],
    overall_health_score: parsed.overall_health_score || 0,
    narrative: parsed.narrative || '',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
