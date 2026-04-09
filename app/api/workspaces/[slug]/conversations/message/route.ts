import { NextRequest } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import { getAnthropicClient } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { buildWorkspaceChatPrompt } from '@/lib/analysis/agent/build-workspace-chat-prompt';
import { routeModel } from '@/lib/analysis/agent/build-chat-prompt';

async function getUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  } catch { return null; }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { slug } = await params;

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { conversation_id, org_id, org_name, message } = body as {
    conversation_id: string | null;
    org_id: string;
    org_name?: string;
    message: string;
  };

  if (!org_id || !message) {
    return new Response(JSON.stringify({ error: 'org_id and message required' }), { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) {
    return new Response(JSON.stringify({ error: 'Workspace not found' }), { status: 404 });
  }

  // Resolve or create conversation
  let convId = conversation_id;
  let existingMessages: { role: string; content: string }[] = [];

  if (convId) {
    const { data: conv } = await supabaseAdmin
      .from('workspace_conversations')
      .select('id, workspace_id, messages')
      .eq('id', convId)
      .single();

    if (!conv || conv.workspace_id !== workspace.id) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
    }

    // Load last 15 messages from JSONB array
    const allMessages = (conv.messages || []) as Array<{ role: string; content: string }>;
    existingMessages = allMessages.slice(-15).map(m => ({ role: m.role, content: m.content }));
  } else {
    const title = message.substring(0, 80) + (message.length > 80 ? '...' : '');
    const { data: conv, error } = await supabaseAdmin
      .from('workspace_conversations')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        title,
        source: 'web',
      })
      .select()
      .single();

    if (error || !conv) {
      return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 500 });
    }
    convId = conv.id;
  }

  // Build system prompt with RAG context
  const { systemPrompt } = await buildWorkspaceChatPrompt(
    workspace,
    org_name || 'Organization',
    message,
  );

  // Route model
  const { model, taskType } = routeModel(message);

  // Format messages
  const formattedMessages = [
    ...existingMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  // Stream response
  const anthropic = getAnthropicClient();

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = '';

      try {
        const stream = await anthropic.messages.create({
          model,
          max_tokens: model.includes('opus') ? 8192 : 4096,
          system: systemPrompt,
          messages: formattedMessages,
          stream: true,
        });

        let inputTokens = 0;
        let outputTokens = 0;

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullResponse += event.delta.text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text: event.delta.text })}\n\n`)
            );
          } else if (event.type === 'message_delta' && event.usage) {
            outputTokens = event.usage.output_tokens;
          } else if (event.type === 'message_start' && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
        }

        // Append messages to conversation JSONB array
        const now = new Date().toISOString();
        const { data: currentConv } = await supabaseAdmin
          .from('workspace_conversations')
          .select('messages')
          .eq('id', convId)
          .single();

        const currentMessages = (currentConv?.messages || []) as Array<Record<string, unknown>>;
        currentMessages.push(
          { role: 'user', content: message, created_at: now },
          { role: 'assistant', content: fullResponse, model_used: model, token_count: outputTokens, created_at: now }
        );

        await supabaseAdmin
          .from('workspace_conversations')
          .update({
            messages: currentMessages,
            updated_at: now,
          })
          .eq('id', convId);

        // Log API usage
        await logApiUsage({
          orgId: org_id,
          endpoint: `workspace_chat_${taskType}`,
          model,
          inputTokens,
          outputTokens,
        });

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
      Connection: 'keep-alive',
    },
  });
}
