'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import VoiceInput from './VoiceInput';

const COMMANDS = [
  { command: '/brief', label: 'Executive Brief', description: 'One-page briefing on a topic' },
  { command: '/compare', label: 'Compare', description: 'Side-by-side comparison table' },
  { command: '/timeline', label: 'Timeline', description: 'Chronological developments' },
  { command: '/talking-points', label: 'Talking Points', description: '5-7 bullets for meetings' },
  { command: '/scorecard', label: 'Scorecard', description: 'Legislative/regulatory scorecard' },
  { command: '/letter', label: 'Draft Letter', description: 'Formal letter or comment template' },
];

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  deepDiveDocName?: string | null;
  onClearDeepDive?: () => void;
  onAttach?: () => void;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = 'Ask your Intelligence Analyst...',
  deepDiveDocName,
  onClearDeepDive,
  onAttach,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!value.startsWith('/')) return [];
    const query = value.split(' ')[0].toLowerCase();
    return COMMANDS.filter(c => c.command.startsWith(query));
  }, [value]);

  useEffect(() => {
    setShowCommands(value.startsWith('/') && !value.includes(' ') && filteredCommands.length > 0);
    setSelectedIndex(0);
  }, [value, filteredCommands.length]);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, [value]);

  function selectCommand(cmd: string) {
    onChange(cmd + ' ');
    setShowCommands(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showCommands) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredCommands[selectedIndex].command);
        return;
      }
      if (e.key === 'Escape') {
        setShowCommands(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  }

  return (
    <div className="border-t border-white/10 p-4" style={{ backgroundColor: 'var(--intel-bg)' }}>
      {disabled && (
        <div className="text-xs opacity-40 mb-2 flex items-center gap-2" style={{ color: 'var(--intel-text)' }}>
          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          Agent is thinking...
        </div>
      )}

      {deepDiveDocName && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-[var(--intel-primary)]/20 border border-[var(--intel-primary)]/30" style={{ color: 'var(--intel-primary)' }}>
            Deep diving: {deepDiveDocName}
          </span>
          {onClearDeepDive && (
            <button onClick={onClearDeepDive} className="text-xs opacity-40 hover:opacity-80" style={{ color: 'var(--intel-text)' }}>
              &times;
            </button>
          )}
        </div>
      )}

      <div className="relative flex items-end gap-2">
        {/* Slash command picker */}
        {showCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-white/10 shadow-xl overflow-hidden z-50" style={{ backgroundColor: 'var(--intel-bg)' }}>
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd.command}
                onClick={() => selectCommand(cmd.command)}
                className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${
                  i === selectedIndex ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-xs font-mono opacity-60" style={{ color: 'var(--intel-primary)' }}>
                  {cmd.command}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: 'var(--intel-text)' }}>{cmd.label}</div>
                  <div className="text-[10px] opacity-40" style={{ color: 'var(--intel-text)' }}>{cmd.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {onAttach && (
          <button
            onClick={onAttach}
            disabled={disabled}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-30 shrink-0"
            style={{ color: 'var(--intel-text)' }}
            title="Attach document for deep analysis"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)] focus:border-transparent disabled:opacity-40"
          style={{ color: 'var(--intel-text)', maxHeight: '150px' }}
        />

        <VoiceInput onTranscript={onChange} disabled={disabled} />

        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="p-2.5 rounded-xl transition-colors disabled:opacity-30 shrink-0"
          style={{ backgroundColor: 'var(--intel-primary)', color: 'white' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
