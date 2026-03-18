'use client';

import { useState, useEffect } from 'react';

export default function ResearchDocumentPicker({
  orgId,
  targetId,
  linkedDocIds,
  onLink,
  onClose,
}: {
  orgId: string;
  targetId: string;
  linkedDocIds: string[];
  onLink: () => void;
  onClose: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intel/documents?orgId=${orgId}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setDocs(data.filter((d: { id: string }) => !linkedDocIds.includes(d.id)));
      }
      setLoading(false);
    }
    load();
  }, [orgId, linkedDocIds]);

  async function linkDoc(docId: string) {
    await fetch(`/api/intel/research-targets/${targetId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: docId }),
    });
    setDocs(prev => prev.filter(d => d.id !== docId));
    onLink();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[70vh] rounded-xl border border-white/10 overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--intel-bg)' }} onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>Link Document</span>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>
          ) : docs.length === 0 ? (
            <div className="p-4 text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>No unlinked documents available</div>
          ) : (
            docs.map(d => (
              <button key={d.id} onClick={() => linkDoc(d.id)} className="w-full px-4 py-3 text-left hover:bg-white/[0.05] border-b border-white/5">
                <div className="text-sm" style={{ color: 'var(--intel-text)' }}>{d.summary_metadata?.title || d.filename}</div>
                <div className="text-[10px] opacity-40 mt-0.5" style={{ color: 'var(--intel-text)' }}>{d.folder_name || d.folder} — {new Date(d.uploaded_at).toLocaleDateString()}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
