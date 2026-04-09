'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface Document {
  id: string;
  title: string;
  source_type: string;
  folder: string;
  summary: string | null;
  original_filename: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

export default function WorkspaceDocumentsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [orgId, setOrgId] = useState('');

  const fetchDocuments = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch(`/api/workspaces/${slug}/documents?org_id=${orgId}`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents || []);
    }
    setLoading(false);
  }, [slug, orgId]);

  // Get org_id from the workspace
  useEffect(() => {
    fetch(`/api/workspaces/${slug}?org_id=_discover`)
      .catch(() => {});
    // For now, extract from page context - in production this would come from layout
    const pathParts = window.location.pathname.split('/');
    const orgSlug = pathParts[2];
    fetch(`/api/workspaces?org_id=_all`)
      .catch(() => {});
    // Store orgId from a data attribute or context
    const el = document.querySelector('[data-org-id]');
    if (el) setOrgId(el.getAttribute('data-org-id') || '');
  }, [slug]);

  useEffect(() => {
    if (orgId) fetchDocuments();
  }, [orgId, fetchDocuments]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('org_id', orgId);

    try {
      const res = await fetch(`/api/workspaces/${slug}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchDocuments();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
    e.target.value = '';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--analysis-text)' }}>
          Documents
        </h1>
        <label
          className="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--analysis-primary)' }}
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {loading ? (
        <p className="text-sm opacity-50" style={{ color: 'var(--analysis-text)' }}>Loading...</p>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 opacity-50" style={{ color: 'var(--analysis-text)' }}>
          <p className="text-lg">No documents yet</p>
          <p className="text-sm mt-1">Upload PDF, Word, or text files to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-4 rounded-xl border border-white/10"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--analysis-text)' }}>
                    {doc.title}
                  </h3>
                  {doc.summary && (
                    <p className="text-xs mt-1 opacity-60 line-clamp-2" style={{ color: 'var(--analysis-text)' }}>
                      {doc.summary}
                    </p>
                  )}
                  <div className="flex gap-3 mt-2 text-xs opacity-40" style={{ color: 'var(--analysis-text)' }}>
                    <span>{doc.source_type}</span>
                    <span>{doc.folder}</span>
                    {doc.file_size_bytes && <span>{(doc.file_size_bytes / 1024).toFixed(0)} KB</span>}
                  </div>
                </div>
                <span className="text-xs opacity-40 shrink-0" style={{ color: 'var(--analysis-text)' }}>
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
