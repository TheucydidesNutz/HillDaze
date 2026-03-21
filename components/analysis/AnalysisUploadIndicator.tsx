'use client';

import { useState, useEffect } from 'react';
import { Check, X, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useUploadQueue } from './AnalysisUploadContext';

export function AnalysisUploadIndicator() {
  const { uploads, clearCompleted, isUploading } = useUploadQueue();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);

  const completedCount = uploads.filter(u => u.status === 'complete').length;
  const errorCount = uploads.filter(u => u.status === 'error').length;
  const activeCount = uploads.filter(u => u.status !== 'complete' && u.status !== 'error').length;
  const allDone = !isUploading && activeCount === 0;

  // Auto-dismiss after 10 seconds when all done with no errors
  useEffect(() => {
    if (allDone && uploads.length > 0 && errorCount === 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => clearCompleted(), 300);
      }, 10000);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [allDone, uploads.length, errorCount, clearCompleted]);

  if (uploads.length === 0) return null;
  if (!visible && allDone) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] w-80 rounded-xl border border-white/10 shadow-2xl overflow-hidden transition-all"
      style={{ backgroundColor: 'var(--analysis-bg, #0f0f23)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2.5">
          {isUploading ? (
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--analysis-primary, #6366f1)' }} />
          ) : errorCount > 0 ? (
            <X size={16} className="text-red-400" />
          ) : (
            <Check size={16} className="text-green-400" />
          )}
          <span className="text-sm" style={{ color: 'var(--analysis-text, #e0e0e0)' }}>
            {isUploading
              ? `Uploading ${activeCount} file${activeCount !== 1 ? 's' : ''}...`
              : `${completedCount} uploaded${errorCount > 0 ? `, ${errorCount} failed` : ''}`
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <span
              onClick={e => { e.stopPropagation(); clearCompleted(); }}
              className="text-[10px] opacity-40 hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--analysis-text, #e0e0e0)' }}
            >
              Dismiss
            </span>
          )}
          {expanded ? <ChevronDown size={14} className="opacity-40" /> : <ChevronUp size={14} className="opacity-40" />}
        </div>
      </button>

      {/* Progress bar */}
      {isUploading && (
        <div className="h-1 bg-white/[0.06]">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((completedCount + errorCount) / uploads.length) * 100}%`,
              backgroundColor: 'var(--analysis-primary, #6366f1)',
            }}
          />
        </div>
      )}

      {/* Expanded file list */}
      {expanded && (
        <div className="max-h-60 overflow-y-auto border-t border-white/5">
          {uploads.map(item => (
            <div key={item.id} className="flex items-center gap-2.5 px-4 py-2 border-b border-white/5 last:border-b-0">
              {item.status === 'complete' && <Check size={14} className="text-green-400 shrink-0" />}
              {item.status === 'error' && <X size={14} className="text-red-400 shrink-0" />}
              {(item.status === 'uploading' || item.status === 'extracting' || item.status === 'summarizing') && (
                <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--analysis-primary, #6366f1)' }} />
              )}
              {item.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full bg-white/10 shrink-0" />}

              <span className="text-xs truncate flex-1" style={{ color: 'var(--analysis-text, #e0e0e0)' }}>
                {item.folderPath ? `${item.folderPath}/` : ''}{item.fileName}
              </span>

              <span className="text-[10px] opacity-30 shrink-0" style={{ color: 'var(--analysis-text, #e0e0e0)' }}>
                {item.status === 'uploading' && 'Uploading...'}
                {item.status === 'extracting' && 'Extracting...'}
                {item.status === 'summarizing' && 'Summarizing...'}
                {item.status === 'error' && (item.error || 'Failed')}
                {item.status === 'pending' && 'Queued'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
