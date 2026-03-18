import { supabase, log, getAllActiveOrgs } from './worker-utils';

async function updateForOrg(orgId: string) {
  const now = new Date().toISOString().split('T')[0];
  const twoWeeks = new Date(Date.now() + 14 * 864e5).toISOString().split('T')[0];

  // Mark past events
  await supabase.from('intel_calendar_events').update({ status: 'passed' }).eq('org_id', orgId).lt('event_date', now).neq('status', 'passed');

  // Mark imminent events
  await supabase.from('intel_calendar_events').update({ status: 'imminent' }).eq('org_id', orgId).gte('event_date', now).lte('event_date', twoWeeks).is('status', null);

  log('calendar', `Updated statuses for org ${orgId}`);
}

async function main() {
  log('calendar', 'Starting calendar status update');
  for (const org of await getAllActiveOrgs()) await updateForOrg(org.id);
  log('calendar', 'Done');
}

main().catch(err => { log('calendar', `Fatal: ${err}`); process.exit(1); });
