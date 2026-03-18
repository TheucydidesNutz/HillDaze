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
    system: `You are an advisory analyst for ${ctx.orgName}.

Current soul document / focus areas:
${ctx.soulDocContent}

Recent news items (last 2 weeks):
${ctx.newsText}

Agent observations from conversations:
${ctx.memoriesText}

Existing recommendations and trends:
${ctx.recsText}

Review the organization's stated focus areas against recent activity. Generate 2-5 focus evolution proposals.

Proposal types:
- add_topic: A new topic gaining traction that should be added
- remove_topic: A topic that has gone quiet and should be deprioritized
- reprioritize: A topic that should move up/down in priority order
- scope_change: A topic whose scope should be expanded or narrowed

For each proposal:
- proposal_type: one of the above
- description: Clear description of the proposed change
- rationale: 2-3 sentences explaining why
- supporting_evidence: Array of strings referencing specific news items, trends, or conversations

Return ONLY a valid JSON array. No markdown.`,
    userMessage: 'Analyze the current focus areas and propose changes.',
    model,
    maxTokens: 4096,
  });

  await logApiUsage({ orgId: org_id, endpoint: 'propose_focus_change', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  let proposals: unknown[];
  try {
    proposals = JSON.parse(result.text);
    if (!Array.isArray(proposals)) proposals = [];
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  const inserted = [];
  for (const p of proposals as Record<string, unknown>[]) {
    const { data } = await supabaseAdmin.from('intel_focus_proposals').insert({
      org_id,
      proposal_type: p.proposal_type,
      description: p.description,
      rationale: p.rationale,
      supporting_evidence: p.supporting_evidence || [],
      status: 'pending',
    }).select().single();
    if (data) inserted.push(data);
  }

  return NextResponse.json(inserted, { status: 201 });
}
