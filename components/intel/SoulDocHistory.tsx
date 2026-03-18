'use client';

import { useState } from 'react';

interface VersionEntry {
  id: string;
  version: number;
  updated_at: string;
  updated_by_name: string;
}

export default function SoulDocHistory({
  orgId,
  versions,
  onRestore,
}: {
  orgId: string;
  versions: VersionEntry[];
  onRestore: (content: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePreview(versionId: string, versionNum: number) {
    setLoading(true);
    const res = await fetch(`/api/intel/soul-document/history?orgId=${orgId}&versionId=${versionId}`);
    if (res.ok) {
      const data = await res.json();
      setPreviewContent(data.content);
      setPreviewVersion(versionNum);
    }
    setLoading(false);
  }

  function handleRestore() {
    if (previewContent !== null) {
      onRestore(previewContent);
      setPreviewContent(null);
      setPreviewVersion(null);
    }
  }

  if (versions.length <= 1) return null;

  return (
    <div className="mt-6 border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium hover:bg-white/[0.03] transition-colors"
        style={{ color: 'var(--intel-text)' }}
      >
        <span>Version History ({versions.length} versions)</span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          {previewContent !== null && (
            <div className="p-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>
                  Previewing v{previewVersion}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleRestore}
                    className="px-3 py-1 text-xs font-medium text-white rounded-lg"
                    style={{ backgroundColor: 'var(--intel-primary)' }}
                  >
                    Restore this version
                  </button>
                  <button
                    onClick={() => { setPreviewContent(null); setPreviewVersion(null); }}
                    className="px-3 py-1 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]"
                    style={{ color: 'var(--intel-text)' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-auto opacity-70" style={{ color: 'var(--intel-text)' }}>
                {previewContent}
              </pre>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => handlePreview(v.id, v.version)}
                disabled={loading}
                className={`w-full px-4 py-2.5 flex items-center justify-between text-sm hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-0 ${
                  previewVersion === v.version ? 'bg-white/[0.05]' : ''
                }`}
                style={{ color: 'var(--intel-text)' }}
              >
                <span className="font-medium">v{v.version}</span>
                <span className="text-xs opacity-50">
                  {v.updated_by_name} &middot; {new Date(v.updated_at).toLocaleDateString()} {new Date(v.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
