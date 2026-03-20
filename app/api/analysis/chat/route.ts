import { NextRequest } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getAnthropicClient } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { getProfile } from '@/lib/analysis/supabase-queries';
import { buildAnalysisChatPrompt, routeModel } from '@/lib/analysis/agent/build-chat-prompt';

async function getUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { conversation_id, profile_id, org_id, org_name, message, focused_input_folder_id, focused_output_folder_id } = body as {
    conversation_id: string | null;
    profile_id: string;
    org_id: string;
    org_name: string;
    message: string;
    focused_input_folder_id?: string | null;
    focused_output_folder_id?: string | null;
  };

  if (!profile_id || !org_id || !message) {
    return new Response(JSON.stringify({ error: 'profile_id, org_id, and message required' }), { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const profile = await getProfile(profile_id);
  if (!profile || profile.org_id !== org_id) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404 });
  }

  // Resolve or create conversation
  let convId = conversation_id;
  let existingMessages: { role: string; content: string }[] = [];

  if (convId) {
    const { data: conv } = await supabaseAdmin
      .from('analysis_conversations')
      .select('id, org_id')
      .eq('id', convId)
      .single();
    if (!conv || conv.org_id !== org_id) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
    }
    // Load last 15 messages
    const { data: msgs } = await supabaseAdmin
      .from('analysis_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(15);
    existingMessages = (msgs || []).map(m => ({ role: m.role, content: m.content }));
  } else {
    const title = message.substring(0, 80) + (message.length > 80 ? '...' : '');
    const { data: conv, error } = await supabaseAdmin
      .from('analysis_conversations')
      .insert({ profile_id, org_id, title })
      .select()
      .single();
    if (error || !conv) {
      return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 500 });
    }
    convId = conv.id;
  }

  // Build system prompt
  const { systemPrompt } = await buildAnalysisChatPrompt(
    profile, org_id, org_name || 'Organization', message,
    focused_input_folder_id || null,
    focused_output_folder_id || null
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

        // Save user message
        await supabaseAdmin.from('analysis_messages').insert({
          conversation_id: convId,
          role: 'user',
          content: message,
          model_used: null,
          token_count: null,
          focused_input_folder_id: focused_input_folder_id || null,
          focused_output_folder_id: focused_output_folder_id || null,
        });

        // Extract citations from response
        const citationMatches = fullResponse.match(/\[SOURCE:([^\]]+)\]/g) || [];
        const citations = citationMatches.map(match => {
          const id = match.replace('[SOURCE:', '').replace(']', '');
          return { data_item_id: id, quote: '', source_url: '' };
        });

        // Save assistant message
        await supabaseAdmin.from('analysis_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: fullResponse,
          citations,
          model_used: model,
          token_count: outputTokens,
          focused_input_folder_id: focused_input_folder_id || null,
          focused_output_folder_id: focused_output_folder_id || null,
        });

        // Update conversation timestamp
        await supabaseAdmin
          .from('analysis_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);

        // Log API usage
        await logApiUsage({
          orgId: org_id,
          endpoint: `analysis_chat_${taskType}`,
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
