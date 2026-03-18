import { supabase, callClaude, logApiUsage, log, getAllActiveOrgs } from './worker-utils';

async function archiveForOrg(orgId: string) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 864e5).toISOString();

  const { data: oldConvos } = await supabase.from('intel_conversations').select('id, title, messages, org_id')
    .eq('org_id', orgId).lt('updated_at', ninetyDaysAgo);

  let archived = 0;
  for (const conv of (oldConvos || [])) {
    const messages = conv.messages || [];
    if (messages.length === 0) continue;

    const msgText = messages.slice(0, 20).map((m: any) => `${m.role}: ${(m.content || '').substring(0, 200)}`).join('\n');

    try {
      const result = await callClaude(
        'Summarize this conversation in 2-3 sentences. Focus on key decisions, insights, and outcomes.',
        `Conversation: ${conv.title}\n\n${msgText}`,
        256
      );

      await logApiUsage(orgId, 'conversation_archive', 'claude-sonnet-4-20250514', result.inputTokens, result.outputTokens);

      // Store archive
      await supabase.from('intel_conversation_archives').insert({
        conversation_id: conv.id, org_id: orgId, summary: result.text,
        message_count: messages.length, archived_at: new Date().toISOString(),
      });

      // Clear messages from conversation
      await supabase.from('intel_conversations').update({ messages: [] }).eq('id', conv.id);
      archived++;
    } catch (err) { log('archive', `Error archiving ${conv.id}: ${err}`); }
  }

  if (archived > 0) log('archive', `Org ${orgId}: archived ${archived} conversations`);
}

async function main() {
  log('archive', 'Starting conversation archival');
  for (const org of await getAllActiveOrgs()) await archiveForOrg(org.id);
  log('archive', 'Done');
}

main().catch(err => { log('archive', `Fatal: ${err}`); process.exit(1); });
