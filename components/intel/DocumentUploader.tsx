'use client';

import { useState, useRef } from 'react';

const ACCEPTED_DOC_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']);
const ACCEPTED_DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'txt']);
function isAcceptedDocFile(f: File): boolean {
  if (ACCEPTED_DOC_TYPES.has(f.type)) return true;
  const ext = f.name.toLowerCase().split('.').pop() || '';
  return ACCEPTED_DOC_EXTS.has(ext);
}

function collectPdfsFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const promises: Promise<void>[] = [];

  // Try the items API first (supports folder drops)
  if (dt.items) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        promises.push(collectFromEntry(entry, files));
      } else if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f && isAcceptedDocFile(f)) files.push(f);
      }
    }
  } else {
    for (let i = 0; i < dt.files.length; i++) {
      if (isAcceptedDocFile(dt.files[i])) files.push(dt.files[i]);
    }
  }

  return Promise.all(promises).then(() => files);
}

function collectFromEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
  return new Promise(resolve => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(f => {
        if (isAcceptedDocFile(f)) files.push(f);
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

export default function DocumentUploader({
  orgId,
  defaultFolder,
  folderId,
  onUploadComplete,
  onClose,
}: {
  orgId: string;
  defaultFolder: 'deep_dive' | 'reference';
  folderId?: string;
  onUploadComplete: () => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [folder] = useState(defaultFolder);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function validateAndAdd(newFiles: File[]) {
    const valid: File[] = [];
    const errors: string[] = [];

    for (const f of newFiles) {
      if (!isAcceptedDocFile(f)) {
        errors.push(`${f.name}: unsupported format`);
      } else if (f.size > 50 * 1024 * 1024) {
        errors.push(`${f.name}: exceeds 50MB`);
      } else {
        // Dedup against already-selected files
        if (!files.some(existing => existing.name === f.name && existing.size === f.size)) {
          valid.push(f);
        }
      }
    }

    if (valid.length > 0) {
      setFiles(prev => [...prev, ...valid]);
    }
    if (errors.length > 0) {
      setError(errors.join('; '));
    } else {
      setError('');
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      validateAndAdd(Array.from(e.target.files));
    }
    // Reset so the same files can be re-selected
    e.target.value = '';
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const pdfs = await collectPdfsFromDataTransfer(e.dataTransfer);
    if (pdfs.length > 0) {
      validateAndAdd(pdfs);
    } else {
      setError('No supported files found in the drop');
    }
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    setCompleted([]);
    setFailed([]);

    const total = files.length;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total });
      setStatus(`Uploading and summarizing "${file.name}"...`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      formData.append('org_id', orgId);
      if (folderId) formData.append('folder_id', folderId);

      try {
        const res = await fetch('/api/intel/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          setCompleted(prev => [...prev, file.name]);
        } else {
          const data = await res.json().catch(() => ({ error: 'Upload failed' }));
          setFailed(prev => [...prev, `${file.name}: ${data.error}`]);
        }
      } catch {
        setFailed(prev => [...prev, `${file.name}: network error`]);
      }
    }

    setProgress(null);
    setStatus('');
    setUploading(false);
    onUploadComplete();

    // Auto-close if all succeeded
    if (failed.length === 0) {
      onClose();
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-white/10 p-6 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--intel-bg)' }}
        onClick={(e) => e.stopPropagation()}
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
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
          <svg className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--intel-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm opacity-50" style={{ color: 'var(--intel-text)' }}>
            Drop files here (PDF, Word, or TXT), or click to browse
          </p>
          <p className="text-[10px] opacity-30 mt-1" style={{ color: 'var(--intel-text)' }}>
            Multiple files supported &middot; 50MB max per file
          </p>
        </div>

        {/* Browse folder button */}
        <button onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }} disabled={uploading}
          className="mt-2 w-full px-3 py-2 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05] disabled:opacity-40"
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
              {!uploading && (
                <button onClick={() => setFiles([])} className="text-[10px] opacity-40 hover:opacity-70" style={{ color: 'var(--intel-text)' }}>
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {files.map((f, i) => {
                const isCompleted = completed.includes(f.name);
                const isFailed = failed.some(msg => msg.startsWith(f.name));
                const isCurrent = progress && progress.current === i + 1 && uploading;

                return (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03]">
                    {isCompleted && (
                      <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isFailed && (
                      <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {isCurrent && (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                    )}
                    {!isCompleted && !isFailed && !isCurrent && (
                      <div className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className={`text-xs truncate flex-1 ${isCompleted ? 'opacity-40 line-through' : ''}`} style={{ color: 'var(--intel-text)' }}>
                      {f.name}
                    </span>
                    <span className="text-[10px] opacity-30 shrink-0" style={{ color: 'var(--intel-text)' }}>
                      {(f.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    {!uploading && (
                      <button onClick={() => removeFile(i)} className="text-[10px] text-red-400/50 hover:text-red-400 shrink-0">&times;</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium" style={{ color: 'var(--intel-primary)' }}>
                Processing file {progress.current} of {progress.total}...
              </p>
              <span className="text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%`, backgroundColor: 'var(--intel-primary)' }}
              />
            </div>
          </div>
        )}

        {status && !progress && (
          <div className="mt-3 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-sm" style={{ color: 'var(--intel-primary)' }}>{status}</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 mt-3">{error}</p>
        )}

        {/* Completed/failed summary */}
        {!uploading && completed.length > 0 && (
          <p className="text-xs text-green-400 mt-2">{completed.length} file{completed.length !== 1 ? 's' : ''} uploaded successfully</p>
        )}
        {!uploading && failed.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-red-400">{failed.length} file{failed.length !== 1 ? 's' : ''} failed:</p>
            {failed.map((msg, i) => (
              <p key={i} className="text-[10px] text-red-400/70 ml-2">{msg}</p>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/[0.05] disabled:opacity-40"
            style={{ color: 'var(--intel-text)' }}
          >
            {completed.length > 0 && !uploading ? 'Done' : 'Cancel'}
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            {uploading
              ? `Processing ${progress?.current || 0}/${progress?.total || files.length}...`
              : `Upload ${files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : '& Summarize'}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
