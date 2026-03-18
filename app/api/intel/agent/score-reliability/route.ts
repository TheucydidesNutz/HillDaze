import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership, getOrgMembers } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id } = await request.json();
  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const members = await getOrgMembers(org_id);
  const results = [];

  for (const m of members) {
    // Get activity for this user
    const { data: activities } = await supabaseAdmin
      .from('intel_user_activity_log')
      .select('*')
      .eq('org_id', org_id)
      .eq('user_id', m.user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    const activityText = (activities || []).map((a: { action_type: string; action_detail: Record<string, unknown>; created_at: string }) =>
      `${a.created_at}: ${a.action_type} — ${JSON.stringify(a.action_detail).substring(0, 100)}`
    ).join('\n') || 'No recorded activity.';

    const model = 'claude-sonnet-4-20250514';
    const result = await callClaude({
      system: `You assess team member engagement for an intelligence platform. Score reliability based on activity patterns. Return ONLY valid JSON: { "reliability_score": 0.75, "score_rationale": "...", "activity_summary": "..." }`,
      userMessage: `User: ${m.display_name} (${m.role})\nRecent activity:\n${activityText}\n\nTotal activities: ${(activities || []).length}`,
      model,
      maxTokens: 512,
    });

    await logApiUsage({ orgId: org_id, endpoint: 'reliability_scoring', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

    try {
      const parsed = JSON.parse(result.text);

      // Upsert reliability record
      const { data: existing } = await supabaseAdmin.from('intel_user_reliability')
        .select('id, score_history').eq('org_id', org_id).eq('user_id', m.user_id).single();

      const history = existing?.score_history || [];
      history.push({ score: parsed.reliability_score, date: new Date().toISOString() });

      if (existing) {
        await supabaseAdmin.from('intel_user_reliability').update({
          reliability_score: parsed.reliability_score,
          score_rationale: parsed.score_rationale,
          activity_summary: parsed.activity_summary,
          total_interactions: (activities || []).length,
          last_scored_at: new Date().toISOString(),
          score_history: history.slice(-20),
        }).eq('id', existing.id);
      } else {
        await supabaseAdmin.from('intel_user_reliability').insert({
          org_id,
          user_id: m.user_id,
          reliability_score: parsed.reliability_score,
          score_rationale: parsed.score_rationale,
          activity_summary: parsed.activity_summary,
          total_interactions: (activities || []).length,
          last_scored_at: new Date().toISOString(),
          score_history: history,
        });
      }

      results.push({ user: m.display_name, score: parsed.reliability_score });
    } catch {
      results.push({ user: m.display_name, error: 'Failed to parse' });
    }
  }

  return NextResponse.json(results);
}
