'use client';

import { useState } from 'react';
import type { IntelDocument, IntelMemberRole } from '@/lib/intel/types';

export default function DocumentSummaryCard({
  document: doc,
  userRole,
  onDelete,
  expanded,
  onToggle,
}: {
  document: IntelDocument;
  userRole: IntelMemberRole;
  onDelete: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = doc.summary_metadata;
  const hasSummary = !!doc.summary;
  const isAdmin = userRole === 'super_admin' || userRole === 'admin';

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden transition-colors hover:border-white/15">
      {/* Collapsed header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-start gap-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate" style={{ color: 'var(--intel-text)' }}>
            {meta?.title || doc.filename}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {meta?.file_type && (
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 opacity-50" style={{ color: 'var(--intel-text)' }}>
                {meta.file_type}
              </span>
            )}
            <span className="text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>
              {doc.uploader_name} &middot; {new Date(doc.uploaded_at).toLocaleDateString()}
            </span>
            {meta?.page_count && (
              <span className="text-xs opacity-30" style={{ color: 'var(--intel-text)' }}>
                &middot; {meta.page_count} {meta.file_type === 'pdf' || !meta.file_type ? 'pages' : 'est. pages'}
              </span>
            )}
          </div>
          {/* Topic badges */}
          {meta?.key_topics && meta.key_topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {meta.key_topics.map((topic) => (
                <span
                  key={topic}
                  className="px-2 py-0.5 text-[10px] rounded-full bg-white/[0.06] border border-white/10"
                  style={{ color: 'var(--intel-text)' }}
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {meta?.possible_duplicates && meta.possible_duplicates.length > 0 && (
            <span className="text-[10px] text-yellow-400 flex items-center gap-1" title={`Similar to: ${meta.possible_duplicates.map(d => d.filename).join(', ')}`}>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Possible duplicate
            </span>
          )}
          {hasSummary ? (
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Summary ready
            </span>
          ) : (
            <span className="text-[10px] text-yellow-400 flex items-center gap-1">
              <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
              Summarizing...
            </span>
          )}
          <svg
            className={`w-4 h-4 opacity-30 transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--intel-text)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && hasSummary && meta && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-4">
          {meta.executive_summary && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-50" style={{ color: 'var(--intel-text)' }}>
                Executive Summary
              </h4>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--intel-text)' }}>
                {meta.executive_summary}
              </p>
            </div>
          )}

          {meta.detailed_summary && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-50" style={{ color: 'var(--intel-text)' }}>
                Detailed Summary
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--intel-text)' }}>
                {meta.detailed_summary}
              </p>
            </div>
          )}

          {meta.key_quotes && meta.key_quotes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-50" style={{ color: 'var(--intel-text)' }}>
                Key Quotes
              </h4>
              <div className="space-y-2">
                {meta.key_quotes.map((q, i) => (
                  <div key={i} className="pl-3 border-l-2 border-white/10">
                    <p className="text-sm italic" style={{ color: 'var(--intel-text)' }}>
                      &ldquo;{q.quote}&rdquo;
                    </p>
                    <p className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--intel-text)' }}>
                      {q.context}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {meta.relevance_to_org && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-50" style={{ color: 'var(--intel-text)' }}>
                Relevance
              </h4>
              <p className="text-sm" style={{ color: 'var(--intel-text)' }}>
                {meta.relevance_to_org}
              </p>
            </div>
          )}

          {meta.actionable_items && meta.actionable_items.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-50" style={{ color: 'var(--intel-text)' }}>
                Actionable Items
              </h4>
              <ul className="space-y-1">
                {meta.actionable_items.map((item, i) => (
                  <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--intel-text)' }}>
                    <span className="opacity-40 mt-0.5">&bull;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Possible duplicates */}
          {meta?.possible_duplicates && meta.possible_duplicates.length > 0 && (
            <div className="p-3 rounded-lg bg-yellow-500/[0.06] border border-yellow-500/20">
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5 text-yellow-400/80">
                Possible Duplicates
              </h4>
              <div className="space-y-1">
                {meta.possible_duplicates.map((dup) => (
                  <p key={dup.id} className="text-xs" style={{ color: 'var(--intel-text)' }}>
                    <span className="opacity-70">{dup.filename}</span>
                    <span className="ml-2 text-yellow-400/60">
                      {Math.round(dup.similarity * 100)}% match
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Delete button */}
          {isAdmin && (
            <div className="pt-2 border-t border-white/5">
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-400">Delete this document?</span>
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="text-xs text-red-400 font-medium hover:text-red-300"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs opacity-50 hover:opacity-80"
                    style={{ color: 'var(--intel-text)' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-400/60 hover:text-red-400"
                >
                  Delete document
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
