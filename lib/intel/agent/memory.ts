import { callClaude } from './client';
import { supabaseAdmin } from '@/lib/supabase';
import { logApiUsage } from './usage';

export async function extractMemories(
  orgId: string,
  conversationId: string,
  messages: { role: string; content: string }[]
) {
  try {
    if (messages.length < 2) return;

    const recentMessages = messages.slice(-6);
    const conversationText = recentMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    const result = await callClaude({
      system: `You extract notable observations from conversations.
Return a JSON array of memories. Each memory has:
- memory_type: "observation" | "decision" | "preference" | "recurring_topic" | "strategic_insight"
- subject: brief topic label (2-5 words)
- content: the observation (1-2 sentences)
- confidence: 0.0-1.0

Rules:
- Most conversations produce 0-2 memories. Many produce 0.
- Only extract genuinely noteworthy items: decisions made, preferences stated,
  recurring interests, strategic insights, new information provided by the user.
- Do NOT extract: greetings, generic questions, the agent's own analysis.
- If nothing noteworthy, return an empty array: []

Return ONLY valid JSON, no markdown.`,
      userMessage: conversationText,
      maxTokens: 1024,
    });

    await logApiUsage({
      orgId,
      endpoint: 'memory_extraction',
      model: 'claude-sonnet-4-20250514',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    let memories: { memory_type: string; subject: string; content: string; confidence: number }[];
    try {
      memories = JSON.parse(result.text);
    } catch {
      return;
    }
    if (!Array.isArray(memories) || memories.length === 0) return;

    for (const memory of memories) {
      const { data: existing } = await supabaseAdmin
        .from('intel_agent_memory')
        .select('id, mention_count')
        .eq('org_id', orgId)
        .eq('subject', memory.subject)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (existing) {
        await supabaseAdmin
          .from('intel_agent_memory')
          .update({
            mention_count: existing.mention_count + 1,
            last_seen_at: new Date().toISOString(),
            content: memory.content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('intel_agent_memory')
          .insert({
            org_id: orgId,
            memory_type: memory.memory_type,
            subject: memory.subject,
            content: memory.content,
            confidence: memory.confidence,
            source_type: 'conversation',
            source_refs: [conversationId],
            mention_count: 1,
          });
      }
    }
  } catch (error) {
    console.error('Memory extraction error:', error);
  }
}
