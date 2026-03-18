import { supabase, callClaude, logApiUsage, log, getAllActiveOrgs } from './worker-utils';

async function scoreForOrg(orgId: string) {
  const { data: members } = await supabase.from('intel_org_members').select('user_id, display_name, role').eq('org_id', orgId);
  if (!members?.length) return;

  for (const m of members) {
    const { data: activities } = await supabase.from('intel_user_activity_log').select('action_type, created_at').eq('org_id', orgId).eq('user_id', m.user_id).order('created_at', { ascending: false }).limit(50);
    const actText = (activities || []).map((a: any) => `${a.created_at}: ${a.action_type}`).join('\n') || 'No activity.';

    try {
      const result = await callClaude(
        'Score user reliability. Return JSON: {"reliability_score":0.75,"score_rationale":"...","activity_summary":"..."}',
        `User: ${m.display_name} (${m.role})\nActivity:\n${actText}\nTotal: ${(activities || []).length}`,
        512
      );
      await logApiUsage(orgId, 'reliability_scoring', 'claude-sonnet-4-20250514', result.inputTokens, result.outputTokens);

      const parsed = JSON.parse(result.text);
      const { data: existing } = await supabase.from('intel_user_reliability').select('id, score_history').eq('org_id', orgId).eq('user_id', m.user_id).single();
      const history = [...(existing?.score_history || []), { score: parsed.reliability_score, date: new Date().toISOString() }].slice(-20);

      const updates = { reliability_score: parsed.reliability_score, score_rationale: parsed.score_rationale, activity_summary: parsed.activity_summary, total_interactions: (activities || []).length, last_scored_at: new Date().toISOString(), score_history: history };

      if (existing) {
        await supabase.from('intel_user_reliability').update(updates).eq('id', existing.id);
      } else {
        await supabase.from('intel_user_reliability').insert({ org_id: orgId, user_id: m.user_id, ...updates });
      }
    } catch (err) { log('reliability', `Error scoring ${m.display_name}: ${err}`); }
  }
  log('reliability', `Scored members for org ${orgId}`);
}

async function main() {
  log('reliability', 'Starting reliability scoring');
  for (const org of await getAllActiveOrgs()) await scoreForOrg(org.id);
  log('reliability', 'Done');
}

main().catch(err => { log('reliability', `Fatal: ${err}`); process.exit(1); });
