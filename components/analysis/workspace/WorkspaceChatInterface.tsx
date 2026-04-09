'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface Props {
  workspaceSlug: string;
  orgId: string;
  orgName: string;
}

export default function WorkspaceChatInterface({ workspaceSlug, orgId, orgName }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceSlug}/conversations?org_id=${orgId}`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations || []);
    }
  }, [workspaceSlug, orgId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    (async () => {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/conversations/${activeConvId}?org_id=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.conversation?.messages || []);
      }
    })();
  }, [activeConvId, workspaceSlug, orgId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  async function sendMessage() {
    if (!input.trim() || streaming) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setStreaming(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/conversations/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConvId,
          org_id: orgId,
          org_name: orgName,
          message: userMessage,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text_delta') {
              accumulated += event.text;
              setStreamingText(accumulated);
            } else if (event.type === 'message_complete') {
              if (!activeConvId && event.conversation_id) {
                setActiveConvId(event.conversation_id);
              }
            }
          } catch {}
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
      setStreamingText('');
      loadConversations();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to get response.' }]);
      }
    }

    setStreaming(false);
    abortRef.current = null;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function newConversation() {
    setActiveConvId(null);
    setMessages([]);
    setStreamingText('');
  }

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/10 flex flex-col shrink-0 hidden lg:flex">
        <button
          onClick={newConversation}
          className="m-3 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--analysis-primary)' }}
        >
          + New Chat
        </button>
        <div className="flex-1 overflow-y-auto px-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConvId(conv.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors mb-1 ${
                activeConvId === conv.id ? 'bg-white/10' : 'hover:bg-white/[0.05]'
              }`}
              style={{ color: 'var(--analysis-text)' }}
            >
              {conv.title}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamingText && (
            <div className="flex items-center justify-center h-full opacity-30">
              <p className="text-sm" style={{ color: 'var(--analysis-text)' }}>
                Start a conversation about this workspace
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-white/10'
                    : ''
                }`}
                style={{ color: 'var(--analysis-text)' }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {streamingText && (
            <div className="flex justify-start">
              <div
                className="max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap"
                style={{ color: 'var(--analysis-text)' }}
              >
                {streamingText}
                <span className="animate-pulse">|</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/10 p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-white/20"
              style={{ color: 'var(--analysis-text)' }}
              disabled={streaming}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-30"
              style={{ backgroundColor: 'var(--analysis-primary)' }}
            >
              {streaming ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
