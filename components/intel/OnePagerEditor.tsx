'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Save, Download, CheckCircle } from 'lucide-react';
import OnePagerPreview from './OnePagerPreview';
import type { OnePagerContent } from '@/lib/intel/reports/generate-one-pager-docx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function OnePagerEditor({
  item,
  orgId,
  onBack,
  onSaved,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any;
  orgId: string;
  onBack: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSaved: (updated: any) => void;
}) {
  const [content, setContent] = useState<OnePagerContent>(item.content);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    async function loadOrg() {
      const res = await fetch('/api/intel/orgs');
      if (!res.ok) return;
      const memberships = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = memberships.find((m: any) => m.org.id === orgId);
      if (m) setOrgName(m.org.name);
    }
    loadOrg();
  }, [orgId]);

  const wordCount = useMemo(() => {
    const text = [
      content.headline,
      content.subheadline,
      content.the_issue,
      content.our_position,
      ...(content.key_points || []),
      content.pullout_stat?.number,
      content.pullout_stat?.context,
      content.the_ask,
    ].filter(Boolean).join(' ');
    return text.split(/\s+/).filter(Boolean).length;
  }, [content]);

  function updateField(field: keyof OnePagerContent, value: unknown) {
    setContent(prev => ({ ...prev, [field]: value }));
  }

  function updateKeyPoint(index: number, value: string) {
    const updated = [...(content.key_points || [])];
    updated[index] = value;
    setContent(prev => ({ ...prev, key_points: updated }));
  }

  function addKeyPoint() {
    setContent(prev => ({ ...prev, key_points: [...(prev.key_points || []), ''] }));
  }

  function removeKeyPoint(index: number) {
    setContent(prev => ({ ...prev, key_points: prev.key_points.filter((_, i) => i !== index) }));
  }

  const save = useCallback(async (status?: string) => {
    setSaving(true);
    setMessage('');
    const body: Record<string, unknown> = {
      content,
      title: content.headline,
    };
    if (status) body.status = status;

    const res = await fetch(`/api/intel/one-pagers/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const updated = await res.json();
      onSaved(updated);
      setMessage(status === 'final' ? 'Marked as final' : 'Saved');
    } else {
      setMessage('Save failed');
    }
    setSaving(false);
  }, [content, item.id, onSaved]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100"
          style={{ color: 'var(--intel-text)' }}
        >
          <ArrowLeft size={16} /> Back to list
        </button>

        <div className="flex items-center gap-3">
          <span className={`text-xs ${wordCount > 500 ? 'text-red-400' : 'opacity-40'}`} style={{ color: wordCount > 500 ? undefined : 'var(--intel-text)' }}>
            {wordCount} words{wordCount > 500 ? ' (over 500)' : ''}
          </span>

          {item.docx_storage_path && (
            <a
              href={`/api/intel/one-pagers/${item.id}/download`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]"
              style={{ color: 'var(--intel-text)' }}
            >
              <Download size={14} /> Download .docx
            </a>
          )}

          {item.status !== 'final' && (
            <button
              onClick={() => save('final')}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
            >
              <CheckCircle size={14} /> Mark as Final
            </button>
          )}

          <button
            onClick={() => save()}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-40"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-2 rounded-lg bg-white/[0.06] border border-white/10 text-xs" style={{ color: 'var(--intel-primary)' }}>
          {message}
        </div>
      )}

      {/* Split view */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold opacity-60" style={{ color: 'var(--intel-text)' }}>Edit</h2>

          <Field label="Headline" value={content.headline} onChange={v => updateField('headline', v)} />
          <Field label="Subheadline" value={content.subheadline} onChange={v => updateField('subheadline', v)} />
          <TextareaField label="The Issue" value={content.the_issue} onChange={v => updateField('the_issue', v)} rows={3} />
          <TextareaField label="Our Position" value={content.our_position} onChange={v => updateField('our_position', v)} rows={3} />

          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: 'var(--intel-text)' }}>Key Points</label>
            {(content.key_points || []).map((point, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={point}
                  onChange={e => updateKeyPoint(i, e.target.value)}
                  className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
                />
                <button
                  onClick={() => removeKeyPoint(i)}
                  className="px-2 text-red-400/50 hover:text-red-400 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={addKeyPoint}
              className="text-xs opacity-40 hover:opacity-80"
              style={{ color: 'var(--intel-primary)' }}
            >
              + Add point
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Pullout Stat Number"
              value={content.pullout_stat?.number || ''}
              onChange={v => updateField('pullout_stat', { ...content.pullout_stat, number: v })}
            />
            <Field
              label="Pullout Stat Context"
              value={content.pullout_stat?.context || ''}
              onChange={v => updateField('pullout_stat', { ...content.pullout_stat, context: v })}
            />
          </div>

          <TextareaField label="The Ask" value={content.the_ask} onChange={v => updateField('the_ask', v)} rows={2} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Name" value={content.contact?.name || ''} onChange={v => updateField('contact', { ...content.contact, name: v })} />
            <Field label="Contact Title" value={content.contact?.title || ''} onChange={v => updateField('contact', { ...content.contact, title: v })} />
            <Field label="Contact Email" value={content.contact?.email || ''} onChange={v => updateField('contact', { ...content.contact, email: v })} />
            <Field label="Contact Phone" value={content.contact?.phone || ''} onChange={v => updateField('contact', { ...content.contact, phone: v })} />
          </div>
        </div>

        {/* Preview */}
        <div>
          <h2 className="text-sm font-semibold opacity-60 mb-4" style={{ color: 'var(--intel-text)' }}>Preview</h2>
          <div className="max-h-[calc(100vh-12rem)] overflow-auto rounded-xl">
            <OnePagerPreview content={content} orgName={orgName} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
      />
    </div>
  );
}
