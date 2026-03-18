import { supabase, log, getAllActiveOrgs } from './worker-utils';

async function consolidateForOrg(orgId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  // Decay old low-confidence memories
  const { data: stale } = await supabase.from('intel_agent_memory').select('id, confidence')
    .eq('org_id', orgId).eq('status', 'active').lt('last_seen_at', thirtyDaysAgo);

  let archived = 0;
  let decayed = 0;
  for (const m of (stale || [])) {
    const newConf = Math.max(0, (m.confidence || 0) - 0.1);
    if (newConf < 0.2) {
      await supabase.from('intel_agent_memory').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', m.id);
      archived++;
    } else {
      await supabase.from('intel_agent_memory').update({ confidence: newConf, updated_at: new Date().toISOString() }).eq('id', m.id);
      decayed++;
    }
  }

  log('memory', `Org ${orgId}: decayed ${decayed}, archived ${archived}`);
}

async function main() {
  log('memory', 'Starting memory consolidation');
  for (const org of await getAllActiveOrgs()) await consolidateForOrg(org.id);
  log('memory', 'Done');
}

main().catch(err => { log('memory', `Fatal: ${err}`); process.exit(1); });
