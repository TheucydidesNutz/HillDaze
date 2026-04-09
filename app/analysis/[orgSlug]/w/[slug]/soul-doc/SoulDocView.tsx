'use client';

import { useState } from 'react';

interface Props {
  workspaceSlug: string;
  orgId: string;
  soulDocMd: string;
  version: number;
}

export default function SoulDocView({ workspaceSlug, orgId, soulDocMd, version }: Props) {
  const [content, setContent] = useState(soulDocMd);
  const [currentVersion, setCurrentVersion] = useState(version);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceSlug}/soul-doc`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, soul_doc_md: content }),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentVersion(data.version);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch(`/api/workspaces/${workspaceSlug}/soul-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setContent(data.soul_doc_md || '');
      setCurrentVersion(data.version);
    }
    setGenerating(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--analysis-text)' }}>
            Soul Document
          </h1>
          <p className="text-xs opacity-40 mt-1" style={{ color: 'var(--analysis-text)' }}>
            Version {currentVersion}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/[0.05] transition-colors disabled:opacity-30"
            style={{ color: 'var(--analysis-text)' }}
          >
            {generating ? 'Generating...' : 'Regenerate'}
          </button>
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setContent(soulDocMd); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/[0.05] transition-colors"
                style={{ color: 'var(--analysis-text)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-30"
                style={{ backgroundColor: 'var(--analysis-primary)' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--analysis-primary)' }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-[60vh] bg-white/[0.05] border border-white/10 rounded-xl p-4 text-sm resize-none focus:outline-none focus:border-white/20 font-mono"
          style={{ color: 'var(--analysis-text)' }}
        />
      ) : content ? (
        <div
          className="prose prose-invert max-w-none text-sm p-4 rounded-xl border border-white/10"
          style={{ color: 'var(--analysis-text)' }}
        >
          <pre className="whitespace-pre-wrap font-sans">{content}</pre>
        </div>
      ) : (
        <div className="text-center py-16 opacity-50" style={{ color: 'var(--analysis-text)' }}>
          <p className="text-lg">No soul document yet</p>
          <p className="text-sm mt-1">Upload documents first, then click Regenerate</p>
        </div>
      )}
    </div>
  );
}
