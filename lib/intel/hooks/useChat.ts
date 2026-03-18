'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ConversationSummary } from '../types';

export function useChat(params: {
  orgId: string;
  orgSlug: string;
  userId: string;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/intel/conversations?orgId=${params.orgId}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
  }, [params.orgId]);

  const loadConversation = useCallback(async (convId: string) => {
    setActiveConversationId(convId);
    setError(null);

    const res = await fetch(`/api/intel/conversations/${convId}`);
    if (res.ok) {
      const conv = await res.json();
      setMessages((conv.messages || []) as ChatMessage[]);
    }
  }, []);

  const sendMessage = useCallback(async (text: string, deepDiveDocId?: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputText('');
    setIsStreaming(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/intel/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          org_id: params.orgId,
          message: text.trim(),
          deep_dive_doc_id: deepDiveDocId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMsg = `Chat request failed (${response.status})`;
        try {
          const errBody = await response.json();
          errMsg = errBody.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text_delta') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + data.text,
                };
                return updated;
              });
            } else if (data.type === 'message_complete') {
              if (data.conversation_id) {
                setActiveConversationId(data.conversation_id);
                // Update URL without navigation
                const newUrl = `/intel/${params.orgSlug}/chat/${data.conversation_id}`;
                window.history.replaceState(null, '', newUrl);
              }
              setIsStreaming(false);
              loadConversations();
            } else if (data.type === 'error') {
              setError(data.error);
              setIsStreaming(false);
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsStreaming(false);
      // Remove empty assistant message on error
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }
  }, [isStreaming, activeConversationId, params.orgId, params.orgSlug, loadConversations]);

  const newConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    window.history.replaceState(null, '', `/intel/${params.orgSlug}/chat`);
  }, [params.orgSlug]);

  const handleDeleteConversation = useCallback(async (convId: string) => {
    const res = await fetch(`/api/intel/conversations/${convId}`, { method: 'DELETE' });
    if (res.ok) {
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) {
        newConversation();
      }
    }
  }, [activeConversationId, newConversation]);

  return {
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    inputText,
    error,
    setInputText,
    sendMessage,
    loadConversations,
    loadConversation,
    newConversation,
    deleteConversation: handleDeleteConversation,
    setActiveConversationId,
  };
}
