import { NextRequest } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import { verifyWorkspaceApiKey } from '@/lib/analysis/workspace-api-auth';
import { getAnthropicClient } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { buildWorkspaceChatPrompt } from '@/lib/analysis/agent/build-workspace-chat-prompt';
import { routeModel } from '@/lib/analysis/agent/build-chat-prompt';
import type { Workspace } from '@/lib/analysis/types';

interface AuthResult {
  workspace: Workspace;
  orgId: string;
  userId: string | null;
  source: 'web' | 'butterrobot' | 'api';
}

async function authenticateRequest(request: NextRequest, slug: string): Promise<AuthResult | null> {
  // Try API key auth first (ButterRobot)
  const apiKeyAuth = await verifyWorkspaceApiKey(request);
  if (apiKeyAuth) {
    if (apiKeyAuth.workspace.slug !== slug) return null;
    return {
      workspace: apiKeyAuth.workspace,
      orgId: apiKeyAuth.orgId,
      userId: null,
      source: 'butterrobot',
    };
  }

  // Fall back to cookie auth (web)
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const orgId = request.headers.get('x-org-id');
    if (!orgId) return null;

    const member = await getUserOrgMembership(orgId, user.id);
    if (!member || member.role === 'viewer') return null;

    const workspace = await getWorkspaceBySlug(orgId, slug);
    if (!workspace) return null;

    return {
      workspace,
      orgId,
      userId: user.id,
      source: 'web',
    };
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const auth = await authenticateRequest(request, slug);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { message, conversation_id } = body as {
    message: string;
    conversation_id?: string | null;
  };

  if (!message) {
    return new Response(JSON.stringify({ error: 'message required' }), { status: 400 });
  }

  const { workspace, orgId, userId, source } = auth;

  // Resolve or create conversation
  let convId = conversation_id || null;
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

    const allMessages = (conv.messages || []) as Array<{ role: string; content: string }>;
    existingMessages = allMessages.slice(-15).map(m => ({ role: m.role, content: m.content }));
  } else {
    const title = message.substring(0, 80) + (message.length > 80 ? '...' : '');
    const { data: conv, error } = await supabaseAdmin
      .from('workspace_conversations')
      .insert({
        workspace_id: workspace.id,
        user_id: userId || '00000000-0000-0000-0000-000000000000',
        title,
        source,
      })
      .select()
      .single();

    if (error || !conv) {
      return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 500 });
    }
    convId = conv.id;
  }

  // Build prompt
  const { systemPrompt } = await buildWorkspaceChatPrompt(workspace, 'Organization', message);
  const { model, taskType } = routeModel(message);

  const formattedMessages = [
    ...existingMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

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

        // Append messages to conversation
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
          .update({ messages: currentMessages, updated_at: now })
          .eq('id', convId);

        await logApiUsage({
          orgId,
          endpoint: `workspace_chat_${taskType}`,
          model,
          inputTokens,
          outputTokens,
        });

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'message_complete', conversation_id: convId })}\n\n`)
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
