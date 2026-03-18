import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { gatherGenerationContext } from '@/lib/intel/agent/gather-context';

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
    system: `You are the intelligence briefing writer for ${ctx.orgName}. Write a concise 3-5 paragraph executive briefing covering the current state of affairs. Be specific, cite sources, and highlight what requires immediate attention.`,
    userMessage: `Generate an executive intelligence briefing.

Organization focus: ${ctx.soulDocContent.substring(0, 500)}

Recent developments: ${ctx.newsText}

Agent observations: ${ctx.memoriesText}

Upcoming deadlines: ${ctx.calendarText}

Key stakeholders: ${ctx.stakeholderText}

Recent recommendations: ${ctx.recsText}

Write a clear, actionable executive summary.`,
    model,
    maxTokens: 2048,
  });

  await logApiUsage({ orgId: org_id, endpoint: 'generate_briefing', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  const now = new Date();
  const { data, error } = await supabaseAdmin.from('intel_briefings').insert({
    org_id,
    briefing_type: 'weekly',
    content: { news: ctx.newsText, calendar: ctx.calendarText, stakeholders: ctx.stakeholderText },
    executive_summary: result.text,
    period_start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    period_end: now.toISOString().split('T')[0],
    generated_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
