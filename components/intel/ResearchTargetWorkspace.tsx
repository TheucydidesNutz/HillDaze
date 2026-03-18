'use client';

import { useState, useEffect, useCallback } from 'react';
import ResearchSummaryView from './ResearchSummaryView';
import ResearchNewsFeed from './ResearchNewsFeed';
import ResearchDocumentPicker from './ResearchDocumentPicker';
import ResearchDocumentUploader from './ResearchDocumentUploader';
import { useUploadManager } from './UploadManager';
import { BookOpen } from 'lucide-react';

export default function ResearchTargetWorkspace({
  targetId,
  orgId,
  orgSlug,
  isAdmin,
}: {
  targetId: string;
  orgId: string;
  orgSlug: string;
  isAdmin: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [target, setTarget] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [showDocUploader, setShowDocUploader] = useState(false);

  const fetchTarget = useCallback(async () => {
    const res = await fetch(`/api/intel/research-targets/${targetId}`, { cache: 'no-store' });
    if (res.ok) setTarget(await res.json());
  }, [targetId]);

  const fetchDocs = useCallback(async () => {
    const res = await fetch(`/api/intel/research-targets/${targetId}/documents`, { cache: 'no-store' });
    if (res.ok) setDocs(await res.json());
  }, [targetId]);

  const { onUploadComplete } = useUploadManager();

  useEffect(() => {
    Promise.all([fetchTarget(), fetchDocs()]).then(() => setLoading(false));
  }, [fetchTarget, fetchDocs]);

  // Auto-refresh when background uploads complete
  useEffect(() => {
    return onUploadComplete(() => { fetchDocs(); });
  }, [onUploadComplete, fetchDocs]);

  async function refreshSummary() {
    setRefreshing(true);
    await fetch(`/api/intel/research-targets/${targetId}/summary`, { method: 'POST' });
    setRefreshing(false);
  }

  async function unlinkDoc(docId: string) {
    await fetch(`/api/intel/research-targets/${targetId}/documents`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: docId }),
    });
    fetchDocs();
  }

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;
  if (!target) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Research target not found.</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={24} className="shrink-0 opacity-60" style={{ color: 'var(--intel-primary)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--intel-text)' }}>{target.name}</h1>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${target.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'}`}>{target.status}</span>
        </div>
        <p className="text-sm opacity-60" style={{ color: 'var(--intel-text)' }}>{target.description}</p>
        <p className="text-sm italic opacity-60 mt-2" style={{ color: 'var(--intel-text)' }}>This workspace accumulates intelligence on a single research topic. Upload relevant documents, review auto-matched news, and refresh the living summary to get an updated brief. The analyst incorporates this research into chat responses and recommendations.</p>
        {target.search_terms?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {target.search_terms.map((t: string) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-primary)' }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <ResearchSummaryView targetId={targetId} onRefresh={refreshSummary} refreshing={refreshing} />

      {/* Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--intel-text)' }}>Documents ({docs.length})</h2>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => setShowDocUploader(true)} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>
                Upload Documents
              </button>
              <button onClick={() => setShowDocPicker(true)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>
                Link Existing
              </button>
            </div>
          )}
        </div>
        {docs.length === 0 ? (
          <div className="p-6 text-center text-sm opacity-40 rounded-xl border border-white/10" style={{ color: 'var(--intel-text)' }}>No documents linked yet.</div>
        ) : (
          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="px-4 py-3 rounded-lg border border-white/5 flex items-center justify-between hover:bg-white/[0.02]">
                <div>
                  <h4 className="text-sm" style={{ color: 'var(--intel-text)' }}>{d.summary_metadata?.title || d.filename}</h4>
                  {d.summary && <p className="text-xs opacity-40 mt-0.5 line-clamp-1" style={{ color: 'var(--intel-text)' }}>{d.summary.substring(0, 120)}</p>}
                </div>
                {isAdmin && (
                  <button onClick={() => unlinkDoc(d.id)} className="text-xs text-red-400/50 hover:text-red-400 shrink-0 ml-3">Unlink</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* News */}
      <ResearchNewsFeed targetId={targetId} />

      {/* Doc picker modal */}
      {showDocPicker && (
        <ResearchDocumentPicker
          orgId={orgId}
          targetId={targetId}
          linkedDocIds={docs.map(d => d.id)}
          onLink={fetchDocs}
          onClose={() => setShowDocPicker(false)}
        />
      )}

      {/* Batch upload modal */}
      {showDocUploader && (
        <ResearchDocumentUploader
          orgId={orgId}
          targetId={targetId}
          onComplete={fetchDocs}
          onClose={() => setShowDocUploader(false)}
        />
      )}
    </div>
  );
}
