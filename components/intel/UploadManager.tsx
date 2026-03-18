'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Check, X, Clock, Loader2, ChevronDown, ChevronUp, RotateCcw, Upload } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

export type UploadItemStatus = 'pending' | 'uploading' | 'complete' | 'failed';

export interface UploadItem {
  id: string;
  file: File;
  orgId: string;
  folder: 'deep_dive' | 'reference';
  folderId?: string;
  // Optional: link to research target after upload
  researchTargetId?: string;
  status: UploadItemStatus;
  error?: string;
}

interface UploadContextValue {
  queue: UploadItem[];
  isProcessing: boolean;
  enqueue: (items: Omit<UploadItem, 'id' | 'status'>[]) => void;
  retry: (id: string) => void;
  dismiss: () => void;
  /** Listeners that fire when any upload completes (for auto-refresh) */
  onUploadComplete: (callback: () => void) => () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploadManager() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploadManager must be used within UploadManagerProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const queueRef = useRef<UploadItem[]>([]);
  const listenersRef = useRef<Set<() => void>>(new Set());

  // Keep ref in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);

  // beforeunload warning
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const hasPending = queueRef.current.some(i => i.status === 'pending' || i.status === 'uploading');
      if (hasPending) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const notifyListeners = useCallback(() => {
    for (const cb of listenersRef.current) cb();
  }, []);

  const onUploadComplete = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => { listenersRef.current.delete(callback); };
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    while (true) {
      const next = queueRef.current.find(i => i.status === 'pending');
      if (!next) break;

      // Mark uploading
      setQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: 'uploading' as const } : i));

      try {
        const formData = new FormData();
        formData.append('file', next.file);
        formData.append('folder', next.folder);
        formData.append('org_id', next.orgId);
        if (next.folderId) formData.append('folder_id', next.folderId);

        const res = await fetch('/api/intel/documents/upload', { method: 'POST', body: formData });

        if (res.ok) {
          const doc = await res.json();

          // If research target, link the document
          if (next.researchTargetId) {
            await fetch(`/api/intel/research-targets/${next.researchTargetId}/documents`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ document_id: doc.id }),
            });
          }

          setQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: 'complete' as const } : i));
          notifyListeners();
        } else {
          const data = await res.json().catch(() => ({ error: 'Upload failed' }));
          setQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: 'failed' as const, error: data.error } : i));
        }
      } catch {
        setQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: 'failed' as const, error: 'Network error' } : i));
      }
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, [notifyListeners]);

  const enqueue = useCallback((items: Omit<UploadItem, 'id' | 'status'>[]) => {
    const newItems: UploadItem[] = items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      status: 'pending',
    }));
    setQueue(prev => [...prev, ...newItems]);
    // Kick off processing on next tick (after state updates)
    setTimeout(() => processQueue(), 0);
  }, [processQueue]);

  const retry = useCallback((id: string) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'pending' as const, error: undefined } : i));
    setTimeout(() => processQueue(), 0);
  }, [processQueue]);

  const dismiss = useCallback(() => {
    setQueue(prev => prev.filter(i => i.status === 'pending' || i.status === 'uploading'));
  }, []);

  return (
    <UploadContext.Provider value={{ queue, isProcessing, enqueue, retry, dismiss, onUploadComplete }}>
      {children}
      {queue.length > 0 && <UploadIndicator />}
    </UploadContext.Provider>
  );
}

// ── Floating indicator ─────────────────────────────────────────

function UploadIndicator() {
  const { queue, isProcessing, retry, dismiss } = useUploadManager();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);

  const completed = queue.filter(i => i.status === 'complete').length;
  const failed = queue.filter(i => i.status === 'failed').length;
  const pending = queue.filter(i => i.status === 'pending').length;
  const uploading = queue.find(i => i.status === 'uploading');
  const total = queue.length;
  const doneCount = completed + failed;
  const allDone = !isProcessing && pending === 0 && !uploading;

  // Auto-dismiss after 10 seconds when all done with no failures
  useEffect(() => {
    if (allDone && failed === 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => dismiss(), 300);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [allDone, failed, dismiss]);

  if (!visible && allDone) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] w-80 rounded-xl border border-white/10 shadow-2xl overflow-hidden transition-all"
      style={{ backgroundColor: 'var(--intel-bg, #1a1a2e)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2.5">
          {allDone ? (
            failed > 0 ? (
              <X size={16} className="text-red-400" />
            ) : (
              <Check size={16} className="text-green-400" />
            )
          ) : (
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--intel-primary, #3b82f6)' }} />
          )}
          <span className="text-sm" style={{ color: 'var(--intel-text, #e0e0e0)' }}>
            {allDone
              ? `${completed} file${completed !== 1 ? 's' : ''} processed${failed > 0 ? `, ${failed} failed` : ''}`
              : `Processing ${doneCount + 1} of ${total} files...`
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <span
              onClick={e => { e.stopPropagation(); dismiss(); }}
              className="text-[10px] opacity-40 hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--intel-text, #e0e0e0)' }}
            >
              Dismiss
            </span>
          )}
          {expanded ? <ChevronDown size={14} className="opacity-40" /> : <ChevronUp size={14} className="opacity-40" />}
        </div>
      </button>

      {/* Progress bar */}
      {!allDone && (
        <div className="h-1 bg-white/[0.06]">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${(doneCount / total) * 100}%`,
              backgroundColor: 'var(--intel-primary, #3b82f6)',
            }}
          />
        </div>
      )}

      {/* Current file name */}
      {uploading && !expanded && (
        <div className="px-4 pb-2">
          <p className="text-[11px] opacity-50 truncate" style={{ color: 'var(--intel-text, #e0e0e0)' }}>
            {uploading.file.name}
          </p>
        </div>
      )}

      {/* Expanded queue */}
      {expanded && (
        <div className="max-h-60 overflow-y-auto border-t border-white/5">
          {queue.map(item => (
            <div
              key={item.id}
              className="px-4 py-2 flex items-center gap-2.5 border-b border-white/5 last:border-b-0"
            >
              <StatusIcon status={item.status} />
              <span
                className={`text-xs truncate flex-1 ${item.status === 'complete' ? 'opacity-40' : ''}`}
                style={{ color: 'var(--intel-text, #e0e0e0)' }}
              >
                {item.file.name}
              </span>
              {item.status === 'failed' && (
                <button
                  onClick={() => retry(item.id)}
                  className="shrink-0 p-1 rounded hover:bg-white/[0.06]"
                  title="Retry"
                >
                  <RotateCcw size={12} className="text-red-400" />
                </button>
              )}
              {item.error && (
                <span className="text-[10px] text-red-400/70 shrink-0 max-w-[120px] truncate" title={item.error}>
                  {item.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadItemStatus }) {
  switch (status) {
    case 'complete':
      return <Check size={14} className="text-green-400 shrink-0" />;
    case 'failed':
      return <X size={14} className="text-red-400 shrink-0" />;
    case 'uploading':
      return <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--intel-primary, #3b82f6)' }} />;
    case 'pending':
      return <Clock size={14} className="opacity-30 shrink-0" style={{ color: 'var(--intel-text, #e0e0e0)' }} />;
  }
}

// ── File picker modal (replaces old DocumentUploader for file selection only) ──

export function UploadFilePicker({
  orgId,
  folder,
  folderId,
  researchTargetId,
  onClose,
}: {
  orgId: string;
  folder: 'deep_dive' | 'reference';
  folderId?: string;
  researchTargetId?: string;
  onClose: () => void;
}) {
  const { enqueue } = useUploadManager();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function validateAndAdd(newFiles: File[]) {
    const valid: File[] = [];
    const errors: string[] = [];
    for (const f of newFiles) {
      if (!isAcceptedFile(f)) {
        errors.push(`${f.name}: unsupported format`);
      } else if (f.size > 50 * 1024 * 1024) {
        errors.push(`${f.name}: exceeds 50MB`);
      } else if (!files.some(ex => ex.name === f.name && ex.size === f.size)) {
        valid.push(f);
      }
    }
    if (valid.length > 0) setFiles(prev => [...prev, ...valid]);
    setError(errors.length > 0 ? errors.join('; ') : '');
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) validateAndAdd(Array.from(e.target.files));
    e.target.value = '';
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const docs = await collectDocsFromDataTransfer(e.dataTransfer);
    if (docs.length > 0) validateAndAdd(docs);
    else setError('No supported files found in the drop');
  }

  function handleSubmit() {
    if (files.length === 0) return;
    enqueue(files.map(file => ({
      file,
      orgId,
      folder,
      folderId,
      researchTargetId,
    })));
    onClose();
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-white/10 p-6 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--intel-bg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--intel-text)' }}>Upload Documents</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-[var(--intel-primary)] bg-white/[0.04]' : 'border-white/10'
          }`}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple onChange={handleFileInput} className="hidden" />
          <input ref={folderRef} type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            {...{ webkitdirectory: '', mozdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
            onChange={handleFileInput} className="hidden" />
          <Upload size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--intel-text)' }} />
          <p className="text-sm opacity-50" style={{ color: 'var(--intel-text)' }}>
            Drop files here (PDF, Word, or TXT), or click to browse
          </p>
          <p className="text-[10px] opacity-30 mt-1" style={{ color: 'var(--intel-text)' }}>
            PDF, .docx, .doc, and .txt supported &middot; 50MB max per file
          </p>
        </div>

        <button onClick={e => { e.stopPropagation(); folderRef.current?.click(); }}
          className="mt-2 w-full px-3 py-2 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]"
          style={{ color: 'var(--intel-text)' }}>
          Browse entire folder...
        </button>

        {/* Selected files list */}
        {files.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs opacity-50" style={{ color: 'var(--intel-text)' }}>
                {files.length} file{files.length !== 1 ? 's' : ''} &middot; {(totalSize / (1024 * 1024)).toFixed(1)} MB total
              </span>
              <button onClick={() => setFiles([])} className="text-[10px] opacity-40 hover:opacity-70" style={{ color: 'var(--intel-text)' }}>
                Clear all
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03]">
                  <span className="text-xs truncate flex-1" style={{ color: 'var(--intel-text)' }}>{f.name}</span>
                  <span className="text-[10px] opacity-30 shrink-0" style={{ color: 'var(--intel-text)' }}>
                    {(f.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-[10px] text-red-400/50 hover:text-red-400 shrink-0">&times;</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={files.length === 0}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            Upload {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const ACCEPTED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt']);

function isAcceptedFile(f: File): boolean {
  if (ACCEPTED_TYPES.has(f.type)) return true;
  const ext = f.name.toLowerCase().split('.').pop() || '';
  return ACCEPTED_EXTENSIONS.has(ext);
}

function collectDocsFromDataTransfer(dt: DataTransfer): Promise<File[]> {
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
        if (f && isAcceptedFile(f)) files.push(f);
      }
    }
  } else {
    for (let i = 0; i < dt.files.length; i++) {
      if (isAcceptedFile(dt.files[i])) files.push(dt.files[i]);
    }
  }
  return Promise.all(promises).then(() => files);
}

function collectFromEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
  return new Promise(resolve => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(f => {
        if (isAcceptedFile(f)) files.push(f);
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
