'use client';

import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  userName?: string;
}

export default function ChatMessage({ role, content, timestamp, isStreaming, userName }: ChatMessageProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] lg:max-w-[60%]">
          <div className="text-[10px] text-right mb-1 opacity-40" style={{ color: 'var(--intel-text)' }}>
            {userName || 'You'}
          </div>
          <div className="px-4 py-3 rounded-2xl rounded-br-md bg-white/[0.08]">
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--intel-text)' }}>
              {content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-4">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-1"
        style={{ backgroundColor: 'var(--intel-primary)' }}
      >
        AI
      </div>
      <div className="flex-1 min-w-0 max-w-[85%]">
        <div className="text-[10px] mb-1 opacity-40" style={{ color: 'var(--intel-text)' }}>
          Intelligence Analyst
        </div>
        <div className="text-sm leading-relaxed" style={{ color: 'var(--intel-text)' }}>
          {content ? (
            <MarkdownRenderer content={content} />
          ) : isStreaming ? (
            <span className="opacity-40">Thinking...</span>
          ) : null}
          {isStreaming && content && (
            <span className="inline-block w-1.5 h-4 bg-[var(--intel-primary)] ml-0.5 animate-pulse align-text-bottom" />
          )}
        </div>
      </div>
    </div>
  );
}
