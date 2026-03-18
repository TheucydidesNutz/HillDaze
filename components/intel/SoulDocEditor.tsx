'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { IntelMemberRole } from '@/lib/intel/types';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface SoulDocEditorProps {
  orgId: string;
  initialContent: string;
  initialVersion: number;
  userRole: IntelMemberRole;
}

export default function SoulDocEditor({
  orgId,
  initialContent,
  initialVersion,
  userRole,
}: SoulDocEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [version, setVersion] = useState(initialVersion);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEdit = userRole === 'super_admin' || userRole === 'admin';

  const charCount = content.length;
  const tokenEstimate = Math.round(charCount / 4);

  const save = useCallback(async (text: string) => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/intel/soul-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, content: text }),
      });
      if (res.ok) {
        const doc = await res.json();
        setVersion(doc.version);
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, [orgId]);

  function handleChange(val: string | undefined) {
    const newContent = val || '';
    setContent(newContent);
    setSaveStatus('unsaved');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(newContent), 3000);
  }

  function handleManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(content);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const statusText = {
    saved: 'Saved',
    saving: 'Saving...',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  };

  const statusColor = {
    saved: 'text-green-400',
    saving: 'text-yellow-400',
    unsaved: 'text-yellow-400',
    error: 'text-red-400',
  };

  if (!canEdit) {
    return (
      <div className="min-h-[500px]" data-color-mode="dark">
        <MDEditor
          value={content}
          preview="preview"
          hideToolbar
          height="100%"
          visibleDragbar={false}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="text-xs opacity-50" style={{ color: 'var(--intel-text)' }}>
            v{version}
          </span>
          <span className={`text-xs ${statusColor[saveStatus]}`}>
            {statusText[saveStatus]}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>
            {charCount.toLocaleString()} chars &middot; ~{tokenEstimate.toLocaleString()} tokens
          </span>
          <button
            onClick={handleManualSave}
            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
            className="px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-[500px]" data-color-mode="dark">
        <MDEditor
          value={content}
          onChange={handleChange}
          height="100%"
          preview="live"
          visibleDragbar={false}
        />
      </div>
    </div>
  );
}
