import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import {
  getUserOrgMembership,
  createConversation,
  getConversation,
  appendConversationMessages,
  updateConversationTitle,
  getDocument,
  logActivity,
} from '@/lib/intel/supabase-queries';
import { getAnthropicClient } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { buildSystemPrompt } from '@/lib/intel/agent/system-prompt';
import { extractMemories } from '@/lib/intel/agent/memory';
import type { ChatMessage } from '@/lib/intel/types';

const COMMAND_PROMPTS: Record<string, string> = {
  '/brief': 'The user is requesting an executive briefing. Generate a structured one-page brief with: Title, Executive Summary (3 sentences), Key Developments (5-7 bullets), Implications for the Organization, Recommended Actions. Be concise and actionable. Format in clean markdown.',
  '/compare': 'The user is requesting a comparison. Create a structured markdown table comparing the items. Include a summary analysis below the table highlighting key differences and the organization\'s best positioning.',
  '/timeline': 'The user is requesting a timeline. Create a chronological list of developments with dates (or approximate dates). Format each entry as: **[Date]** — Event description and significance. Most recent first.',
  '/talking-points': 'The user is requesting talking points for a meeting or briefing. Generate exactly 5-7 concise, punchy bullet points. Each should be 1-2 sentences. Lead with the strongest point. Include one data point or specific reference per bullet where possible.',
  '/scorecard': 'The user is requesting a legislative or regulatory scorecard. Create a markdown table with columns: Item | Status | Our Position | Priority | Next Action. Include all relevant tracked items. Add a brief summary paragraph below.',
  '/letter': 'The user is requesting a formal letter or comment draft. Include: recipient and address block, date, RE: line, salutation, body paragraphs (clear and professional), closing. Mark prominently as DRAFT FOR REVIEW at the top.',
};

async function getUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[intel/agent/chat] auth.getUser error:', error.message);
      return null;
    }
    return user;
  } catch (err) {
    console.error('[intel/agent/chat] getUser exception:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await getUser();
  } catch (err) {
    console.error('[intel/agent/chat] getUser threw:', err);
    return new Response(JSON.stringify({ error: 'Auth failed' }), { status: 500 });
  }

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { conversation_id, org_id, message, deep_dive_doc_id } = body as {
    conversation_id: string | null;
    org_id: string;
    message: string;
    deep_dive_doc_id?: string;
  };

  if (!org_id || !message) {
    return new Response(JSON.stringify({ error: 'org_id and message required' }), { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    console.error(`[intel/agent/chat] Forbidden: user=${user.id} org=${org_id} member=${JSON.stringify(member)}`);
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Resolve or create conversation
  let convId: string | null = conversation_id;
  let existingMessages: ChatMessage[] = [];
  let systemPrompt: string;
  let formattedMessages: { role: 'user' | 'assistant'; content: string }[];

  try {
    if (convId) {
      const conv = await getConversation(convId);
      if (!conv || conv.org_id !== org_id) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
      }
      existingMessages = (conv.messages || []) as ChatMessage[];
    } else {
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      const conv = await createConversation({
        org_id,
        user_id: user.id,
        title,
      });
      if (!conv) {
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 500 });
      }
      convId = conv.id;
    }

    // Detect slash commands
    let userContent = message;
    for (const [cmd, prompt] of Object.entries(COMMAND_PROMPTS)) {
      if (message.startsWith(cmd)) {
        const topic = message.slice(cmd.length).trim();
        userContent = `${prompt}\n\nTopic/Subject: ${topic}`;
        break;
      }
    }

    // Optionally with deep-dive doc
    if (deep_dive_doc_id) {
      const doc = await getDocument(deep_dive_doc_id);
      if (doc?.full_text) {
        userContent += `\n\n[Full document text for deep analysis — "${doc.summary_metadata?.title || doc.filename}"]:\n${doc.full_text}`;
      }
    }

    // Build system prompt
    systemPrompt = await buildSystemPrompt(org_id, user.id);

    // Format conversation history for Claude
    formattedMessages = [
      ...existingMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userContent },
    ];
  } catch (err) {
    console.error('[intel/agent/chat] pre-stream error:', err);
    return new Response(JSON.stringify({ error: 'Failed to prepare chat context' }), { status: 500 });
  }

  // Stream response
  const anthropic = getAnthropicClient();
  const model = 'claude-sonnet-4-20250514';

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = '';

      try {
        const stream = await anthropic.messages.create({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: formattedMessages,
          stream: true,
        });

        let inputTokens = 0;
        let outputTokens = 0;

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`)
            );
          } else if (event.type === 'message_delta' && event.usage) {
            outputTokens = event.usage.output_tokens;
          } else if (event.type === 'message_start' && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
        }

        // Save messages to conversation
        const userMsg: ChatMessage = {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        };
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        };

        await appendConversationMessages(convId!, [userMsg, assistantMsg]);

        // Auto-title from first message if this is a new conversation
        if (!conversation_id && existingMessages.length === 0) {
          // Title already set during creation
        }

        // Log API usage
        await logApiUsage({
          orgId: org_id,
          endpoint: 'chat',
          model,
          inputTokens,
          outputTokens,
        });

        // Log activity
        await logActivity({
          org_id,
          user_id: user.id,
          action_type: 'chat_message',
          action_detail: {
            conversation_id: convId,
            message_preview: message.substring(0, 100),
          },
        });

        // Fire-and-forget memory extraction
        const allMsgs = [...existingMessages, userMsg, assistantMsg];
        extractMemories(org_id, convId!, allMsgs).catch(console.error);

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'message_complete',
            conversation_id: convId,
          })}\n\n`)
        );
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
