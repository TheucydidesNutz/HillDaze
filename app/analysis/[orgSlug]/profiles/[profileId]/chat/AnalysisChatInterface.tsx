'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Plus, PanelLeftClose, PanelLeft, Loader2, ExternalLink, Square } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileInfo {
  id: string;
  full_name: string;
  position_type: string | null;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface Citation {
  index: number;
  sourceId: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: string;
}

interface FocusedFolder {
  id: string;
  name: string;
  folder_type: 'input' | 'output';
  item_count: number;
}

interface Props {
  profile: ProfileInfo;
  orgId: string;
  orgName: string;
  orgSlug: string;
}

// ---------------------------------------------------------------------------
// Simple Markdown Renderer
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={`code-${i}`}
          className="rounded-lg p-3 my-2 text-sm overflow-x-auto"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-semibold mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg font-semibold mt-3 mb-1">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl font-bold mt-3 mb-1">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*]\s/)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        listItems.push(
          <li key={`li-${i}`} className="ml-4 list-disc">
            {renderInline(lines[i].replace(/^[-*]\s/, ''))}
          </li>
        );
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1.5">
          {listItems}
        </ul>
      );
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        listItems.push(
          <li key={`oli-${i}`} className="ml-4 list-decimal">
            {renderInline(lines[i].replace(/^\d+\.\s/, ''))}
          </li>
        );
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-1.5">
          {listItems}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p-${i}`} className="my-1">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Process bold, italic, and inline code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded text-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Plain text until next special char
    const nextSpecial = remaining.slice(1).search(/[`*]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else {
      parts.push(remaining.slice(0, nextSpecial + 1));
      remaining = remaining.slice(nextSpecial + 1);
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Citation helpers
// ---------------------------------------------------------------------------

function extractCitations(content: string): { cleaned: string; citations: Citation[] } {
  const citations: Citation[] = [];
  const citationMap = new Map<string, number>();
  let index = 1;

  const cleaned = content.replace(/\[SOURCE:([^\]]+)\]/g, (_match, sourceId: string) => {
    const id = sourceId.trim();
    if (!citationMap.has(id)) {
      citationMap.set(id, index);
      citations.push({ index, sourceId: id });
      index++;
    }
    const num = citationMap.get(id)!;
    return `[__CITE_${num}__]`;
  });

  return { cleaned, citations };
}

function renderContentWithCitations(
  content: string,
  citations: Citation[],
  onCitationClick: (sourceId: string) => void
): React.ReactNode[] {
  const { cleaned, citations: extractedCitations } = extractCitations(content);
  const allCitations = extractedCitations.length > 0 ? extractedCitations : citations;

  // Split on citation placeholders and render
  const segments = cleaned.split(/\[__CITE_(\d+)__\]/);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0) {
      // Text segment - render as markdown
      nodes.push(...renderMarkdown(segments[i]));
    } else {
      // Citation number
      const num = parseInt(segments[i], 10);
      const cite = allCitations.find(c => c.index === num);
      nodes.push(
        <button
          key={`cite-${i}`}
          onClick={() => cite && onCitationClick(cite.sourceId)}
          className="inline-flex items-center justify-center text-xs font-medium rounded-full w-4 h-4 align-super cursor-pointer hover:opacity-80 transition-opacity"
          style={{ color: 'var(--analysis-primary)', backgroundColor: 'color-mix(in srgb, var(--analysis-primary) 15%, transparent)' }}
          title={cite?.sourceId}
        >
          {num}
        </button>
      );
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AnalysisChatInterface({ profile, orgId, orgName, orgSlug }: Props) {
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const [focusedFolders, setFocusedFolders] = useState<FocusedFolder[]>([]);
  const [focusedInputFolderId, setFocusedInputFolderId] = useState<string | null>(null);
  const [focusedOutputFolderId, setFocusedOutputFolderId] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxHeight = 6 * 24; // ~6 rows
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // Fetch conversations and focused folders on mount
  useEffect(() => {
    fetchConversations();
    fetchFocusedFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchConversations() {
    try {
      setLoadingConversations(true);
      const res = await fetch(`/api/analysis/chat/conversations?profile_id=${profile.id}&org_id=${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      setConversations(data.conversations || []);

      // Load most recent conversation
      if (data.conversations?.length > 0 && !activeConversationId) {
        loadConversation(data.conversations[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }

  async function fetchFocusedFolders() {
    try {
      const res = await fetch(`/api/analysis/focused-folders?profile_id=${profile.id}&org_id=${orgId}`);
      if (!res.ok) return;
      const data = await res.json();
      setFocusedFolders(data.folders || []);
    } catch (err) {
      console.error('Failed to fetch focused folders:', err);
    }
  }

  async function loadConversation(conversationId: string) {
    try {
      setLoadingMessages(true);
      setActiveConversationId(conversationId);
      setError(null);

      const res = await fetch(`/api/analysis/chat/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();

      const loadedMessages: Message[] = (data.messages || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
        citations: (m.citations as Citation[]) || [],
        created_at: m.created_at as string,
      }));

      setMessages(loadedMessages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    } finally {
      setLoadingMessages(false);
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setStreamingContent('');
    setError(null);
    textareaRef.current?.focus();
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      citations: [],
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setStreamingContent('');
    setIsStreaming(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/analysis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          profile_id: profile.id,
          org_id: orgId,
          org_name: orgName,
          message: trimmed,
          focused_input_folder_id: focusedInputFolderId || null,
          focused_output_folder_id: focusedOutputFolderId || null,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || `Request failed with status ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let finalConversationId = activeConversationId;
      let finalMessageId = '';
      let finalCitations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const data = JSON.parse(raw);

            if (data.type === 'text_delta') {
              fullContent += data.text;
              setStreamingContent(fullContent);
            } else if (data.type === 'message_complete') {
              finalConversationId = data.conversation_id || finalConversationId;
              finalMessageId = data.message_id || `msg-${Date.now()}`;
              finalCitations = data.citations || [];
            } else if (data.type === 'error') {
              setError(data.error || 'An error occurred');
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      // Finalize message
      if (fullContent) {
        const assistantMessage: Message = {
          id: finalMessageId || `msg-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          citations: finalCitations,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setStreamingContent('');
      }

      // Update conversation id if new
      if (finalConversationId && finalConversationId !== activeConversationId) {
        setActiveConversationId(finalConversationId);
      }

      // Refresh sidebar
      fetchConversations();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User stopped the stream
        if (streamingContent) {
          setMessages(prev => [
            ...prev,
            {
              id: `msg-stopped-${Date.now()}`,
              role: 'assistant',
              content: streamingContent,
              citations: [],
              created_at: new Date().toISOString(),
            },
          ]);
          setStreamingContent('');
        }
      } else {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(message);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  function stopStreaming() {
    abortControllerRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleCitationClick(sourceId: string) {
    setExpandedCitation(prev => (prev === sourceId ? null : sourceId));
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderConversationSidebar() {
    return (
      <div
        className={`${sidebarOpen ? 'w-[260px]' : 'w-0'} flex-shrink-0 transition-all duration-200 overflow-hidden border-r`}
        style={{ borderColor: 'var(--analysis-border)', backgroundColor: 'var(--analysis-sidebar-bg, var(--analysis-bg))' }}
      >
        <div className="w-[260px] h-full flex flex-col">
          {/* New conversation button */}
          <div className="p-3">
            <button
              onClick={startNewConversation}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--analysis-primary)', color: '#ffffff' }}
            >
              <Plus size={16} />
              New Conversation
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--analysis-text-muted, var(--analysis-text))' }} />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs px-2 py-4 text-center opacity-50" style={{ color: 'var(--analysis-text)' }}>
                No conversations yet
              </p>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors text-sm truncate ${
                    conv.id === activeConversationId ? 'font-medium' : 'hover:opacity-80'
                  }`}
                  style={{
                    color: 'var(--analysis-text)',
                    backgroundColor:
                      conv.id === activeConversationId
                        ? 'color-mix(in srgb, var(--analysis-primary) 15%, transparent)'
                        : 'transparent',
                  }}
                >
                  <div className="truncate">{conv.title || 'Untitled'}</div>
                  <div className="text-xs opacity-50 mt-0.5">{formatRelativeDate(conv.updated_at)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderChatHeader() {
    const activeConv = conversations.find(c => c.id === activeConversationId);

    return (
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--analysis-border)' }}
      >
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(prev => !prev)}
          className="p-1.5 rounded-md transition-colors hover:opacity-70"
          style={{ color: 'var(--analysis-text)' }}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

        {/* Title area */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--analysis-text)' }}>
            {profile.full_name}
            {activeConv && (
              <span className="font-normal opacity-60"> &mdash; {activeConv.title}</span>
            )}
          </div>
        </div>

        {/* Focused folder dropdowns */}
        <div className="flex items-center gap-2">
          <select
            value={focusedInputFolderId || ''}
            onChange={e => setFocusedInputFolderId(e.target.value || null)}
            className="text-xs px-2 py-1 rounded border"
            style={{
              borderColor: 'var(--analysis-border)',
              backgroundColor: 'var(--analysis-bg)',
              color: 'var(--analysis-text)',
            }}
          >
            <option value="">Focused Input: None</option>
            {focusedFolders
              .filter(f => f.folder_type === 'input')
              .map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.item_count})
                </option>
              ))}
          </select>
          <select
            value={focusedOutputFolderId || ''}
            onChange={e => setFocusedOutputFolderId(e.target.value || null)}
            className="text-xs px-2 py-1 rounded border"
            style={{
              borderColor: 'var(--analysis-border)',
              backgroundColor: 'var(--analysis-bg)',
              color: 'var(--analysis-text)',
            }}
          >
            <option value="">Focused Output: None</option>
            {focusedFolders
              .filter(f => f.folder_type === 'output')
              .map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.item_count})
                </option>
              ))}
          </select>
        </div>
      </div>
    );
  }

  function renderMessage(msg: Message) {
    const isUser = msg.role === 'user';
    const { cleaned, citations } = msg.role === 'assistant' ? extractCitations(msg.content) : { cleaned: msg.content, citations: [] };
    const allCitations = citations.length > 0 ? citations : msg.citations;

    return (
      <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        {!isUser && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-1 text-xs font-bold"
            style={{ backgroundColor: 'var(--analysis-primary)', color: '#ffffff' }}
          >
            CA
          </div>
        )}

        <div className={`max-w-[75%] ${isUser ? '' : 'flex-1 max-w-[75%]'}`}>
          {/* Message bubble */}
          <div
            className={`px-4 py-3 text-sm leading-relaxed ${
              isUser ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
            }`}
            style={
              isUser
                ? { backgroundColor: 'var(--analysis-primary)', color: '#ffffff' }
                : { backgroundColor: 'color-mix(in srgb, var(--analysis-text) 8%, transparent)', color: 'var(--analysis-text)' }
            }
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            ) : (
              <div className="prose-sm">
                {renderContentWithCitations(cleaned, allCitations, handleCitationClick)}
              </div>
            )}
          </div>

          {/* Citation pills for assistant messages */}
          {!isUser && allCitations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 px-1">
              {allCitations.map(cite => (
                <button
                  key={cite.index}
                  onClick={() => handleCitationClick(cite.sourceId)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--analysis-primary) 12%, transparent)',
                    color: 'var(--analysis-primary)',
                  }}
                >
                  <span className="font-medium">[{cite.index}]</span>
                  <span className="truncate max-w-[140px]">{cite.sourceId}</span>
                </button>
              ))}
            </div>
          )}

          {/* Expanded citation card */}
          {!isUser && expandedCitation && allCitations.some(c => c.sourceId === expandedCitation) && (
            <div
              className="mt-2 p-3 rounded-lg border text-xs"
              style={{
                borderColor: 'var(--analysis-border)',
                backgroundColor: 'color-mix(in srgb, var(--analysis-primary) 5%, var(--analysis-bg))',
                color: 'var(--analysis-text)',
              }}
            >
              <div className="font-medium mb-1">Source: {expandedCitation}</div>
              <div className="flex items-center gap-1 opacity-60">
                <ExternalLink size={12} />
                <span>View in data lake</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderStreamingMessage() {
    if (!streamingContent) return null;

    return (
      <div className="flex justify-start mb-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-1 text-xs font-bold"
          style={{ backgroundColor: 'var(--analysis-primary)', color: '#ffffff' }}
        >
          CA
        </div>
        <div className="max-w-[75%]">
          <div
            className="px-4 py-3 text-sm leading-relaxed rounded-2xl rounded-bl-sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--analysis-text) 8%, transparent)', color: 'var(--analysis-text)' }}
          >
            <div className="prose-sm">
              {renderMarkdown(streamingContent)}
              <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ backgroundColor: 'var(--analysis-primary)' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderEmptyState() {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold"
            style={{ backgroundColor: 'color-mix(in srgb, var(--analysis-primary) 15%, transparent)', color: 'var(--analysis-primary)' }}
          >
            CA
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--analysis-text)' }}>
            Start a conversation about {profile.full_name}
          </h2>
          <p className="text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
            Ask questions, request analysis, or generate briefing materials. All responses are grounded in verified source data.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div
      className="-m-4 lg:-m-8 flex h-[calc(100vh-3.5rem)]"
      style={{ backgroundColor: 'var(--analysis-bg)' }}
    >
      {/* Sidebar */}
      {renderConversationSidebar()}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        {renderChatHeader()}

        {/* Messages area */}
        {loadingMessages ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--analysis-primary)' }} />
          </div>
        ) : messages.length === 0 && !streamingContent ? (
          renderEmptyState()
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto">
              {messages.map(msg => renderMessage(msg))}
              {renderStreamingMessage()}
              {error && (
                <div className="mb-4 p-3 rounded-lg border text-sm" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="flex-shrink-0 border-t px-4 py-3" style={{ borderColor: 'var(--analysis-border)' }}>
          <div className="max-w-3xl mx-auto">
            <div
              className="flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors"
              style={{
                borderColor: 'var(--analysis-border)',
                backgroundColor: 'color-mix(in srgb, var(--analysis-text) 3%, var(--analysis-bg))',
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask about ${profile.full_name}...`}
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:opacity-40"
                style={{
                  color: 'var(--analysis-text)',
                  minHeight: '24px',
                  maxHeight: '144px',
                }}
              />

              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="p-1.5 rounded-lg transition-colors hover:opacity-80 flex-shrink-0"
                  style={{ backgroundColor: 'var(--analysis-primary)', color: '#ffffff' }}
                  title="Stop generating"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-30"
                  style={{
                    backgroundColor: input.trim() ? 'var(--analysis-primary)' : 'transparent',
                    color: input.trim() ? '#ffffff' : 'var(--analysis-text)',
                  }}
                  title="Send message"
                >
                  <Send size={16} />
                </button>
              )}
            </div>

            <p className="text-xs mt-2 text-center opacity-40" style={{ color: 'var(--analysis-text)' }}>
              All responses cite verified sources. Model routing: questions &rarr; Sonnet, content generation &rarr; Opus
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
