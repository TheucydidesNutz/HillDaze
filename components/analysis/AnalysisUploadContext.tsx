'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// ── Types ──────────────────────────────────────────────────────

export type UploadStatus = 'pending' | 'uploading' | 'extracting' | 'summarizing' | 'complete' | 'error';

export interface UploadItem {
  id: string;
  file: File;
  profileId: string;
  orgId: string;
  storageTier: 'deep_dive' | 'reference';
  folderPath: string;
  status: UploadStatus;
  error?: string;
  dataItem?: Record<string, unknown>;
  fileName: string;
}

interface UploadContextType {
  uploads: UploadItem[];
  addUploads: (items: Array<{
    file: File;
    profileId: string;
    orgId: string;
    storageTier: 'deep_dive' | 'reference';
    folderPath: string;
  }>) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  isUploading: boolean;
  onUploadComplete: (callback: () => void) => () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function useUploadQueue() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploadQueue must be used within AnalysisUploadProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────

export function AnalysisUploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const processingRef = useRef(false);
  // queueRef is the SOURCE OF TRUTH for the async processing loop.
  // State is derived from it for rendering. Never overwrite ref from state.
  const queueRef = useRef<UploadItem[]>([]);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const notifyListeners = useCallback(() => {
    for (const cb of listenersRef.current) cb();
  }, []);

  const onUploadComplete = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => { listenersRef.current.delete(callback); };
  }, []);

  // Sync ref → state (triggers re-render for UI)
  function syncToState() {
    setUploads([...queueRef.current]);
  }

  // Update a single item in the ref, then sync to state
  function updateItem(id: string, updates: Partial<UploadItem>) {
    queueRef.current = queueRef.current.map(u =>
      u.id === id ? { ...u, ...updates } : u
    );
    syncToState();
  }

  // beforeunload warning
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const hasPending = queueRef.current.some(
        i => i.status === 'pending' || i.status === 'uploading' || i.status === 'extracting' || i.status === 'summarizing'
      );
      if (hasPending) e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Process queue — one file at a time, sequential
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (true) {
      const next = queueRef.current.find(u => u.status === 'pending');
      if (!next) break;

      // Mark as uploading — ref is updated synchronously before any await
      updateItem(next.id, { status: 'uploading' });

      try {
        const formData = new FormData();
        formData.append('file', next.file);
        formData.append('profile_id', next.profileId);
        formData.append('org_id', next.orgId);
        formData.append('storage_tier', next.storageTier);
        if (next.folderPath) formData.append('folder_path', next.folderPath);

        updateItem(next.id, { status: 'extracting' });

        const res = await fetch('/api/analysis/data-items/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const dataItem = await res.json();
          updateItem(next.id, { status: 'complete', dataItem });
          notifyListeners();
        } else {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          updateItem(next.id, { status: 'error', error: err.error });
        }
      } catch {
        updateItem(next.id, { status: 'error', error: 'Network error' });
      }
    }

    processingRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifyListeners]);

  const addUploads = useCallback((items: Array<{
    file: File;
    profileId: string;
    orgId: string;
    storageTier: 'deep_dive' | 'reference';
    folderPath: string;
  }>) => {
    const newItems: UploadItem[] = items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      status: 'pending' as const,
      fileName: item.file.name,
    }));

    queueRef.current = [...queueRef.current, ...newItems];
    syncToState();

    // Kick off processing on next tick
    setTimeout(() => processQueue(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processQueue]);

  const clearCompleted = useCallback(() => {
    queueRef.current = queueRef.current.filter(u => u.status !== 'complete' && u.status !== 'error');
    syncToState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = useCallback(() => {
    queueRef.current = queueRef.current.filter(u =>
      u.status === 'uploading' || u.status === 'extracting' || u.status === 'summarizing'
    );
    syncToState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isUploading = uploads.some(
    u => u.status === 'pending' || u.status === 'uploading' || u.status === 'extracting' || u.status === 'summarizing'
  );

  return (
    <UploadContext.Provider value={{ uploads, addUploads, clearCompleted, clearAll, isUploading, onUploadComplete }}>
      {children}
    </UploadContext.Provider>
  );
}
