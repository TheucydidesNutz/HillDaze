'use client';

import type { ConversationSummary } from '@/lib/intel/types';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 left-0 h-full w-[280px] z-50 flex flex-col border-r border-white/10 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--intel-bg)' }}
      >
        <div className="p-3">
          <button
            onClick={() => { onNew(); onClose(); }}
            className="w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-6 text-xs text-center opacity-30" style={{ color: 'var(--intel-text)' }}>
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative px-3 py-2.5 cursor-pointer transition-colors border-b border-white/5 ${
                  activeId === conv.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.03]'
                }`}
                onClick={() => { onSelect(conv.id); onClose(); }}
              >
                <div className="text-sm font-medium truncate pr-6" style={{ color: 'var(--intel-text)' }}>
                  {conv.title || 'Untitled'}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>
                    {timeAgo(conv.updated_at)}
                  </span>
                  {conv.message_preview && (
                    <span className="text-[10px] opacity-20 truncate" style={{ color: 'var(--intel-text)' }}>
                      {conv.message_preview}
                    </span>
                  )}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity text-red-400 p-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
