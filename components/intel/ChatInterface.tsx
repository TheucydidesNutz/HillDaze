'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChat } from '@/lib/intel/hooks/useChat';
import ChatSidebar from './ChatSidebar';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import DocumentPicker from './DocumentPicker';
import type { IntelMemberRole } from '@/lib/intel/types';

interface ChatInterfaceProps {
  orgId: string;
  orgSlug: string;
  orgName: string;
  userId: string;
  userRole: IntelMemberRole;
  userName: string;
  initialConversationId?: string;
}

const SUGGESTED_PROMPTS = [
  'Summarize our uploaded documents',
  'What are our priority policy areas?',
  'Suggest article topics based on current trends',
  'What should we be tracking this month?',
];

export default function ChatInterface({
  orgId,
  orgSlug,
  orgName,
  userId,
  userRole,
  userName,
  initialConversationId,
}: ChatInterfaceProps) {
  const {
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
    deleteConversation,
  } = useChat({ orgId, orgSlug, userId });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [deepDiveDoc, setDeepDiveDoc] = useState<{ id: string; title: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load initial conversation if provided
  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, [initialConversationId, loadConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!userScrolledUp && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, userScrolledUp]);

  // Detect user scroll
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setUserScrolledUp(!isAtBottom);
  }, []);

  function handleSend() {
    sendMessage(inputText, deepDiveDoc?.id);
    setDeepDiveDoc(null);
  }

  function jumpToLatest() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUserScrolledUp(false);
  }

  const hasConversation = activeConversationId || messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 lg:-m-8">
      {/* Conversation sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={loadConversation}
        onNew={newConversation}
        onDelete={deleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile sidebar toggle */}
        <div className="lg:hidden border-b border-white/10 px-4 py-2 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/10"
            style={{ color: 'var(--intel-text)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm opacity-60" style={{ color: 'var(--intel-text)' }}>
            {activeConversationId
              ? conversations.find(c => c.id === activeConversationId)?.title || 'Conversation'
              : 'New Conversation'}
          </span>
        </div>

        {hasConversation ? (
          <>
            {/* Messages area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 lg:px-8 py-6"
            >
              {messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
                  userName={msg.role === 'user' ? userName : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Jump to latest */}
            {userScrolledUp && (
              <div className="flex justify-center -mt-12 relative z-10">
                <button
                  onClick={jumpToLatest}
                  className="px-3 py-1.5 text-xs rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
                  style={{ color: 'var(--intel-text)' }}
                >
                  Jump to latest
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-4 lg:mx-8 mb-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Input area */}
            <div className="relative">
              {showDocPicker && (
                <div className="absolute bottom-full left-4 z-50">
                  <DocumentPicker
                    orgId={orgId}
                    onSelect={(doc) => setDeepDiveDoc(doc)}
                    onClose={() => setShowDocPicker(false)}
                  />
                </div>
              )}
              <ChatInput
                value={inputText}
                onChange={setInputText}
                onSend={handleSend}
                disabled={isStreaming}
                deepDiveDocName={deepDiveDoc?.title}
                onClearDeepDive={() => setDeepDiveDoc(null)}
                onAttach={() => setShowDocPicker(!showDocPicker)}
              />
            </div>
          </>
        ) : (
          /* Welcome screen */
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="max-w-lg text-center">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: 'var(--intel-primary)' }}
              >
                AI
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>
                {orgName} Intelligence Analyst
              </h2>
              <p className="text-sm opacity-50 mb-4" style={{ color: 'var(--intel-text)' }}>
                Ask questions about policy, get strategic recommendations, analyze documents, and draft communications informed by your organization&apos;s priorities.
              </p>
              <p className="text-sm italic opacity-40 mb-8" style={{ color: 'var(--intel-text)' }}>
                Your analyst draws from your Soul Document, uploaded documents, live news feeds, research targets, and accumulated observations to provide org-aware strategic guidance. Use /commands for structured outputs like briefings, talking points, and comparison tables.
              </p>

              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInputText(prompt);
                      sendMessage(prompt);
                    }}
                    className="px-3 py-2 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05] transition-colors text-left"
                    style={{ color: 'var(--intel-text)' }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input at bottom for welcome screen too */}
              <div className="relative">
                {showDocPicker && (
                  <div className="absolute bottom-full left-0 z-50">
                    <DocumentPicker
                      orgId={orgId}
                      onSelect={(doc) => setDeepDiveDoc(doc)}
                      onClose={() => setShowDocPicker(false)}
                    />
                  </div>
                )}
                <ChatInput
                  value={inputText}
                  onChange={setInputText}
                  onSend={handleSend}
                  disabled={isStreaming}
                  deepDiveDocName={deepDiveDoc?.title}
                  onClearDeepDive={() => setDeepDiveDoc(null)}
                  onAttach={() => setShowDocPicker(!showDocPicker)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
