'use client';

import { useState, useEffect } from 'react';
import type { IntelDocument } from '@/lib/intel/types';

export default function DocumentPicker({
  orgId,
  onSelect,
  onClose,
}: {
  orgId: string;
  onSelect: (doc: { id: string; title: string }) => void;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<IntelDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intel/documents?orgId=${orgId}&folder=deep_dive`);
      if (res.ok) {
        const data = await res.json();
        setDocs(data);
      }
      setLoading(false);
    }
    load();
  }, [orgId]);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 max-h-60 overflow-y-auto rounded-xl border border-white/10 shadow-xl z-50" style={{ backgroundColor: 'var(--intel-bg)' }}>
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs font-medium opacity-60" style={{ color: 'var(--intel-text)' }}>
          Attach document for deep analysis
        </span>
        <button onClick={onClose} className="text-xs opacity-40 hover:opacity-80" style={{ color: 'var(--intel-text)' }}>
          &times;
        </button>
      </div>

      {loading ? (
        <div className="px-3 py-4 text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>
      ) : docs.length === 0 ? (
        <div className="px-3 py-4 text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>
          No deep-dive documents available
        </div>
      ) : (
        docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => {
              onSelect({ id: doc.id, title: doc.summary_metadata?.title || doc.filename });
              onClose();
            }}
            className="w-full px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors border-b border-white/5 last:border-0"
          >
            <div className="text-sm truncate" style={{ color: 'var(--intel-text)' }}>
              {doc.summary_metadata?.title || doc.filename}
            </div>
            {doc.summary_metadata?.key_topics && doc.summary_metadata.key_topics.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {doc.summary_metadata.key_topics.slice(0, 3).map((t) => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
}
