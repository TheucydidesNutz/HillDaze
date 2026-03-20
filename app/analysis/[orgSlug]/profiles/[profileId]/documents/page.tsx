'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Upload, FileText, Folder, ChevronDown, ChevronRight, Loader2, Check, X, AlertCircle } from 'lucide-react';

type StorageTier = 'deep_dive' | 'reference';
type UploadStatus = 'pending' | 'uploading' | 'extracting' | 'summarizing' | 'complete' | 'error';

interface UploadFile {
  id: string;
  file: File;
  folderPath: string;
  status: UploadStatus;
  error?: string;
  dataItem?: Record<string, unknown>;
}

interface DataItem {
  id: string;
  title: string;
  folder_path: string | null;
  storage_tier: string;
  original_filename: string;
  file_size_bytes: number;
  summary: string | null;
  key_topics: string[];
  item_date: string | null;
  verification_status: string;
  created_at: string;
}

interface FolderAnalysis {
  id: string;
  folder_path: string;
  analysis: {
    theme_summary?: string;
    common_topics?: string[];
    tone_patterns?: string;
    position_evolution?: string;
    contradictions?: string;
    key_insights?: string[];
  };
  item_count: number;
  last_regenerated_at: string;
}

export default function DocumentsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const profileId = params.profileId as string;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [storageTier, setStorageTier] = useState<StorageTier>('deep_dive');
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [documents, setDocuments] = useState<DataItem[]>([]);
  const [folderAnalyses, setFolderAnalyses] = useState<FolderAnalysis[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  // CSV preview state
  const [csvPreview, setCsvPreview] = useState<{
    file: File;
    folderPath: string;
    filename: string;
    row_count: number;
    headers: string[];
    detected_format: 'donation' | 'generic';
    sample_rows: Record<string, string>[];
    suggestion: string;
  } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  // Fetch org ID and profile
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/intel/orgs');
        const memberships = await res.json();
        const match = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
        if (match) {
          setOrgId(match.org.id);
        }

        // Fetch profile name
        // We'll get it from the data items response or profile endpoint
      } catch (err) {
        console.error('Failed to init:', err);
      }
      setLoading(false);
    }
    init();
  }, [orgSlug]);

  // Fetch documents and folder analyses when orgId is available
  const fetchDocuments = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/analysis/data-items?profile_id=${profileId}&org_id=${orgId}&category=uploaded_doc&limit=200`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  }, [orgId, profileId]);

  const fetchFolderAnalyses = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/analysis/folder-analyses?profile_id=${profileId}&org_id=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setFolderAnalyses(data.analyses || []);
      }
    } catch (err) {
      console.error('Failed to fetch folder analyses:', err);
    }
  }, [orgId, profileId]);

  useEffect(() => {
    if (orgId) {
      fetchDocuments();
      fetchFolderAnalyses();

      // Fetch profile name
      fetch(`/api/analysis/data-items?profile_id=${profileId}&org_id=${orgId}&limit=0`)
        .then(() => {
          // Profile name will come from the profile endpoint
        })
        .catch(() => {});
    }
  }, [orgId, profileId, fetchDocuments, fetchFolderAnalyses]);

  // Process upload queue
  const processQueue = useCallback(async () => {
    if (processingRef.current || !orgId) return;
    processingRef.current = true;

    while (true) {
      const next = uploads.find(u => u.status === 'pending');
      if (!next) break;

      // Mark as uploading
      setUploads(prev => prev.map(u => u.id === next.id ? { ...u, status: 'uploading' as const } : u));

      try {
        // CSV files go through preview flow instead of direct upload
        if (next.file.name.toLowerCase().endsWith('.csv')) {
          try {
            const previewForm = new FormData();
            previewForm.append('file', next.file);
            const previewRes = await fetch('/api/analysis/data-items/csv-preview', {
              method: 'POST',
              body: previewForm,
            });
            if (previewRes.ok) {
              const previewData = await previewRes.json();
              setCsvPreview({
                file: next.file,
                folderPath: next.folderPath,
                ...previewData,
              });
              // Mark as complete — the actual import happens after user confirms
              setUploads(prev => prev.map(u => u.id === next.id ? { ...u, status: 'complete' as const } : u));
              continue; // Skip the normal upload flow
            }
          } catch {
            // Fall through to normal upload on preview failure
          }
        }

        const formData = new FormData();
        formData.append('file', next.file);
        formData.append('profile_id', profileId);
        formData.append('org_id', orgId);
        formData.append('storage_tier', storageTier);
        if (next.folderPath) formData.append('folder_path', next.folderPath);

        // Mark as extracting
        setUploads(prev => prev.map(u => u.id === next.id ? { ...u, status: 'extracting' as const } : u));

        const res = await fetch('/api/analysis/data-items/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const dataItem = await res.json();
          setUploads(prev => prev.map(u => u.id === next.id ? { ...u, status: 'complete' as const, dataItem } : u));
          // Refresh documents list
          await fetchDocuments();
          // Refresh folder analyses after a short delay (they run fire-and-forget on the server)
          setTimeout(() => fetchFolderAnalyses(), 5000);
        } else {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          setUploads(prev => prev.map(u => u.id === next.id ? { ...u, status: 'error' as const, error: err.error } : u));
        }
      } catch {
        setUploads(prev => prev.map(u => u.id === next.id ? { ...u, status: 'error' as const, error: 'Network error' } : u));
      }
    }

    processingRef.current = false;
  }, [orgId, profileId, storageTier, uploads, fetchDocuments, fetchFolderAnalyses]);

  useEffect(() => {
    const hasPending = uploads.some(u => u.status === 'pending');
    if (hasPending && !processingRef.current) {
      processQueue();
    }
  }, [uploads, processQueue]);

  // File handling
  function addFiles(files: File[], basePath: string = '') {
    const accepted = ['pdf', 'doc', 'docx', 'txt', 'csv'];
    const newUploads: UploadFile[] = [];
    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop() || '';
      if (!accepted.includes(ext)) continue;
      if (file.size > 50 * 1024 * 1024) continue;

      // Extract folder path from webkitRelativePath or basePath
      let folderPath = basePath;
      if (file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/');
        if (parts.length > 1) {
          folderPath = parts.slice(0, -1).join('/');
        }
      }

      newUploads.push({
        id: crypto.randomUUID(),
        file,
        folderPath,
        status: 'pending',
      });
    }
    if (newUploads.length > 0) {
      setUploads(prev => [...prev, ...newUploads]);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = await collectFilesFromDrop(e.dataTransfer);
    if (files.length > 0) addFiles(files);
  }

  function toggleFolder(path: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  // Group documents by folder
  const folderGroups = new Map<string, DataItem[]>();
  const rootDocs: DataItem[] = [];
  for (const doc of documents) {
    if (doc.folder_path) {
      const existing = folderGroups.get(doc.folder_path) || [];
      existing.push(doc);
      folderGroups.set(doc.folder_path, existing);
    } else {
      rootDocs.push(doc);
    }
  }

  // Sort folder analyses by path depth
  const sortedAnalyses = [...folderAnalyses].sort((a, b) => {
    const depthA = a.folder_path.split('/').length;
    const depthB = b.folder_path.split('/').length;
    return depthA - depthB || a.folder_path.localeCompare(b.folder_path);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin opacity-40" style={{ color: 'var(--analysis-text)' }} />
      </div>
    );
  }

  const completedCount = uploads.filter(u => u.status === 'complete').length;
  const errorCount = uploads.filter(u => u.status === 'error').length;
  const processingCount = uploads.filter(u => ['pending', 'uploading', 'extracting', 'summarizing'].includes(u.status)).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--analysis-text)' }}>Documents</h1>
          <p className="text-sm opacity-50 mt-1" style={{ color: 'var(--analysis-text)' }}>
            Upload and analyze documents for this profile
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--analysis-primary)' }}
        >
          <Upload size={16} />
          Upload Files
        </button>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv" multiple onChange={handleFileInput} className="hidden" />
      <input ref={folderRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv"
        {...{ webkitdirectory: '', mozdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
        onChange={handleFileInput} className="hidden" />

      {/* Storage tier selector */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs opacity-50" style={{ color: 'var(--analysis-text)' }}>Storage tier:</span>
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          <button
            onClick={() => setStorageTier('deep_dive')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              storageTier === 'deep_dive' ? 'bg-white/10' : 'hover:bg-white/[0.05]'
            }`}
            style={{ color: storageTier === 'deep_dive' ? 'var(--analysis-primary)' : 'var(--analysis-text)' }}
          >
            Deep Dive
          </button>
          <button
            onClick={() => setStorageTier('reference')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-white/10 ${
              storageTier === 'reference' ? 'bg-white/10' : 'hover:bg-white/[0.05]'
            }`}
            style={{ color: storageTier === 'reference' ? 'var(--analysis-primary)' : 'var(--analysis-text)' }}
          >
            Reference
          </button>
        </div>
        <span className="text-[10px] opacity-30" style={{ color: 'var(--analysis-text)' }}>
          {storageTier === 'deep_dive' ? 'Full text stored permanently for detailed analysis' : 'Summary only — full text in storage, re-readable on demand'}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-6 ${
          dragOver ? 'border-[var(--analysis-primary)] bg-white/[0.04]' : 'border-white/10'
        }`}
      >
        <Upload size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--analysis-text)' }} />
        <p className="text-sm opacity-50" style={{ color: 'var(--analysis-text)' }}>
          Drop files or folders here (PDF, Word, TXT, CSV)
        </p>
        <p className="text-[10px] opacity-30 mt-1" style={{ color: 'var(--analysis-text)' }}>
          Folder structure is preserved as metadata — 50MB max per file
        </p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05] transition-colors"
            style={{ color: 'var(--analysis-text)' }}
          >
            Browse Files
          </button>
          <button
            onClick={() => folderRef.current?.click()}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05] transition-colors"
            style={{ color: 'var(--analysis-text)' }}
          >
            Browse Folder
          </button>
        </div>
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="mb-6 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--analysis-text)' }}>
              Upload Queue
              {processingCount > 0 && ` — Processing ${completedCount + 1} of ${uploads.length}`}
            </span>
            {processingCount === 0 && (
              <button
                onClick={() => setUploads([])}
                className="text-[10px] opacity-40 hover:opacity-70"
                style={{ color: 'var(--analysis-text)' }}
              >
                Clear
              </button>
            )}
          </div>
          {/* Progress bar */}
          {processingCount > 0 && (
            <div className="h-1 bg-white/[0.06]">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${((completedCount + errorCount) / uploads.length) * 100}%`,
                  backgroundColor: 'var(--analysis-primary)',
                }}
              />
            </div>
          )}
          <div className="max-h-40 overflow-y-auto">
            {uploads.map(u => (
              <div key={u.id} className="flex items-center gap-2 px-4 py-2 border-b border-white/5 last:border-b-0">
                {u.status === 'complete' ? <Check size={14} className="text-green-400 shrink-0" /> :
                 u.status === 'error' ? <X size={14} className="text-red-400 shrink-0" /> :
                 <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--analysis-primary)' }} />}
                <span className="text-xs truncate flex-1" style={{ color: 'var(--analysis-text)' }}>
                  {u.folderPath ? `${u.folderPath}/` : ''}{u.file.name}
                </span>
                <span className="text-[10px] opacity-30 shrink-0" style={{ color: 'var(--analysis-text)' }}>
                  {u.status === 'uploading' ? 'Uploading...' :
                   u.status === 'extracting' ? 'Extracting text...' :
                   u.status === 'summarizing' ? 'Summarizing...' :
                   u.status === 'error' ? u.error : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Folder Analyses */}
      {sortedAnalyses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3 opacity-70" style={{ color: 'var(--analysis-text)' }}>
            Folder Analysis
          </h2>
          <div className="space-y-2">
            {sortedAnalyses.map(fa => {
              const depth = fa.folder_path.split('/').length - 1;
              const isExpanded = expandedFolders.has(fa.folder_path);
              return (
                <div
                  key={fa.id}
                  className="border border-white/10 rounded-xl overflow-hidden"
                  style={{ marginLeft: depth * 16 }}
                >
                  <button
                    onClick={() => toggleFolder(fa.folder_path)}
                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/[0.03] transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Folder size={14} className="opacity-50" />
                    <span className="text-sm font-medium" style={{ color: 'var(--analysis-text)' }}>
                      {fa.folder_path}
                    </span>
                    <span className="text-[10px] opacity-30 ml-auto" style={{ color: 'var(--analysis-text)' }}>
                      {fa.item_count} item{fa.item_count !== 1 ? 's' : ''}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2 border-t border-white/5">
                      {fa.analysis.theme_summary && (
                        <p className="text-sm mt-3" style={{ color: 'var(--analysis-text)', opacity: 0.8 }}>
                          {fa.analysis.theme_summary}
                        </p>
                      )}
                      {fa.analysis.common_topics && fa.analysis.common_topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {fa.analysis.common_topics.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] border border-white/10"
                              style={{ color: 'var(--analysis-text)' }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {fa.analysis.position_evolution && (
                        <div className="mt-2">
                          <span className="text-[10px] uppercase tracking-wider opacity-40" style={{ color: 'var(--analysis-text)' }}>Evolution</span>
                          <p className="text-xs opacity-70 mt-0.5" style={{ color: 'var(--analysis-text)' }}>{fa.analysis.position_evolution}</p>
                        </div>
                      )}
                      {fa.analysis.contradictions && fa.analysis.contradictions !== 'None detected' && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <span className="text-[10px] uppercase tracking-wider text-amber-400">Contradictions</span>
                          <p className="text-xs text-amber-300 mt-0.5">{fa.analysis.contradictions}</p>
                        </div>
                      )}
                      {fa.analysis.key_insights && fa.analysis.key_insights.length > 0 && (
                        <div className="mt-2">
                          <span className="text-[10px] uppercase tracking-wider opacity-40" style={{ color: 'var(--analysis-text)' }}>Key Insights</span>
                          <ul className="mt-1 space-y-0.5">
                            {fa.analysis.key_insights.map((insight, i) => (
                              <li key={i} className="text-xs opacity-70" style={{ color: 'var(--analysis-text)' }}>
                                — {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Document list */}
      <div>
        <h2 className="text-sm font-semibold mb-3 opacity-70" style={{ color: 'var(--analysis-text)' }}>
          Uploaded Documents ({documents.length})
        </h2>

        {documents.length === 0 && uploads.length === 0 ? (
          <div className="text-center py-12 border border-white/5 rounded-xl">
            <FileText size={32} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--analysis-text)' }} />
            <p className="text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
              No documents uploaded yet
            </p>
            <p className="text-xs opacity-25 mt-1" style={{ color: 'var(--analysis-text)' }}>
              Drop files above or click Upload to get started
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Render folder groups first */}
            {Array.from(folderGroups.entries()).sort().map(([path, docs]) => (
              <div key={path}>
                <div className="flex items-center gap-2 px-3 py-2 opacity-50">
                  <Folder size={12} />
                  <span className="text-xs font-medium" style={{ color: 'var(--analysis-text)' }}>{path}/</span>
                  <span className="text-[10px] opacity-50" style={{ color: 'var(--analysis-text)' }}>({docs.length})</span>
                </div>
                {docs.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </div>
            ))}
            {/* Root docs */}
            {rootDocs.map(doc => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>

      {/* CSV Preview Modal */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCsvPreview(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--analysis-bg, #0f0f23)' }}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold" style={{ color: 'var(--analysis-text)' }}>
                CSV Import Preview
              </h2>
              <p className="text-sm opacity-60 mt-1" style={{ color: 'var(--analysis-text)' }}>
                {csvPreview.suggestion}
              </p>
            </div>

            {/* Preview table */}
            <div className="px-6 py-4 max-h-[300px] overflow-auto">
              <p className="text-xs font-medium opacity-50 mb-2" style={{ color: 'var(--analysis-text)' }}>
                {csvPreview.row_count} rows &middot; {csvPreview.headers.length} columns &middot; Format: {csvPreview.detected_format}
              </p>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-xs" style={{ color: 'var(--analysis-text)' }}>
                  <thead>
                    <tr className="border-b border-white/10">
                      {csvPreview.headers.slice(0, 8).map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold opacity-70 whitespace-nowrap">{h}</th>
                      ))}
                      {csvPreview.headers.length > 8 && (
                        <th className="px-3 py-2 text-left opacity-40">+{csvPreview.headers.length - 8} more</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.sample_rows.map((row, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {csvPreview.headers.slice(0, 8).map(h => (
                          <td key={h} className="px-3 py-1.5 opacity-70 whitespace-nowrap max-w-[200px] truncate">
                            {row[h] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
              <button onClick={() => setCsvPreview(null)}
                className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/[0.05] transition-colors"
                style={{ color: 'var(--analysis-text)' }}>
                Cancel
              </button>
              <div className="flex items-center gap-3">
                {csvPreview.detected_format === 'donation' && (
                  <button
                    onClick={async () => {
                      setCsvImporting(true);
                      const form = new FormData();
                      form.append('file', csvPreview.file);
                      form.append('profile_id', profileId);
                      form.append('org_id', orgId!);
                      form.append('import_mode', 'rows');
                      form.append('folder_path', csvPreview.folderPath);
                      const res = await fetch('/api/analysis/data-items/csv-upload', { method: 'POST', body: form });
                      const data = await res.json();
                      setCsvImporting(false);
                      setCsvPreview(null);
                      if (res.ok) {
                        fetchDocuments();
                        alert(`Imported ${data.items_created} donation records${data.truncated ? ` (limited to first 100 of ${data.total_rows})` : ''}`);
                      }
                    }}
                    disabled={csvImporting}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-white/10 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
                    style={{ color: 'var(--analysis-primary, #6366f1)' }}
                  >
                    {csvImporting ? 'Importing...' : `Import as ${csvPreview.row_count} Records`}
                  </button>
                )}
                <button
                  onClick={async () => {
                    setCsvImporting(true);
                    const form = new FormData();
                    form.append('file', csvPreview.file);
                    form.append('profile_id', profileId);
                    form.append('org_id', orgId!);
                    form.append('import_mode', 'single');
                    form.append('folder_path', csvPreview.folderPath);
                    const res = await fetch('/api/analysis/data-items/csv-upload', { method: 'POST', body: form });
                    setCsvImporting(false);
                    setCsvPreview(null);
                    if (res.ok) fetchDocuments();
                  }}
                  disabled={csvImporting}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40"
                  style={{ backgroundColor: 'var(--analysis-primary, #6366f1)' }}
                >
                  {csvImporting ? 'Importing...' : 'Import as Single Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc }: { doc: DataItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/5 rounded-lg overflow-hidden hover:border-white/10 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <FileText size={14} className="opacity-40 shrink-0" style={{ color: 'var(--analysis-text)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate" style={{ color: 'var(--analysis-text)' }}>
            {doc.title || doc.original_filename}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {doc.item_date && (
              <span className="text-[10px] opacity-40" style={{ color: 'var(--analysis-text)' }}>
                {new Date(doc.item_date).toLocaleDateString()}
              </span>
            )}
            <span className="text-[10px] opacity-30" style={{ color: 'var(--analysis-text)' }}>
              {formatFileSize(doc.file_size_bytes)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              doc.storage_tier === 'deep_dive' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'
            }`}>
              {doc.storage_tier === 'deep_dive' ? 'Deep Dive' : 'Reference'}
            </span>
          </div>
        </div>
        {doc.key_topics.length > 0 && (
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {doc.key_topics.slice(0, 3).map((t, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.06] border border-white/10"
                style={{ color: 'var(--analysis-text)' }}>
                {t}
              </span>
            ))}
          </div>
        )}
        {doc.verification_status === 'unverified' && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-yellow-500/10 text-yellow-400 shrink-0">
            <AlertCircle size={10} /> Unverified
          </span>
        )}
        {expanded ? <ChevronDown size={14} className="opacity-30 shrink-0" /> : <ChevronRight size={14} className="opacity-30 shrink-0" />}
      </button>
      {expanded && doc.summary && (
        <div className="px-4 pb-4 border-t border-white/5">
          <p className="text-sm mt-3 leading-relaxed opacity-70" style={{ color: 'var(--analysis-text)' }}>
            {doc.summary}
          </p>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper to collect files from drag-and-drop, preserving folder structure
async function collectFilesFromDrop(dt: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const promises: Promise<void>[] = [];
  if (dt.items) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        promises.push(collectFromEntry(entry, files));
      } else if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
  } else {
    for (let i = 0; i < dt.files.length; i++) {
      files.push(dt.files[i]);
    }
  }
  await Promise.all(promises);
  return files;
}

function collectFromEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
  return new Promise(resolve => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(f => {
        const ext = f.name.toLowerCase().split('.').pop() || '';
        if (['pdf', 'doc', 'docx', 'txt', 'csv'].includes(ext)) {
          // Preserve the relative path
          Object.defineProperty(f, 'webkitRelativePath', {
            value: entry.fullPath.replace(/^\//, ''),
            writable: false,
          });
          files.push(f);
        }
        resolve();
      }, () => resolve());
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      reader.readEntries(entries => {
        Promise.all(entries.map(e => collectFromEntry(e, files))).then(() => resolve());
      }, () => resolve());
    } else {
      resolve();
    }
  });
}
