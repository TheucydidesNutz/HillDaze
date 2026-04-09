'use client';

import { useState } from 'react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  output_format: string;
  last_generated_at: string | null;
  created_at: string;
}

interface Report {
  id: string;
  template_id: string;
  title: string;
  created_at: string;
}

interface Props {
  workspaceSlug: string;
  orgId: string;
  templates: Template[];
  reports: Report[];
}

export default function ReportsView({ workspaceSlug, orgId, templates: initialTemplates, reports: initialReports }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [reports, setReports] = useState(initialReports);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  async function createTemplate() {
    if (!newName.trim()) return;
    const res = await fetch(`/api/workspaces/${workspaceSlug}/reports/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, name: newName, generation_prompt: newPrompt || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(prev => [data.template, ...prev]);
      setNewName('');
      setNewPrompt('');
      setShowNewTemplate(false);
    }
  }

  async function generateReport(templateId: string) {
    setGenerating(templateId);
    const res = await fetch(`/api/workspaces/${workspaceSlug}/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, template_id: templateId }),
    });
    if (res.ok) {
      const data = await res.json();
      setReports(prev => [data.report, ...prev]);
    }
    setGenerating(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--analysis-text)' }}>Reports</h1>
        <button
          onClick={() => setShowNewTemplate(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--analysis-primary)' }}
        >
          New Template
        </button>
      </div>

      {showNewTemplate && (
        <div className="p-4 rounded-xl border border-white/10 mb-6 space-y-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name"
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ color: 'var(--analysis-text)' }}
          />
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Generation instructions (optional)"
            rows={3}
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
            style={{ color: 'var(--analysis-text)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={createTemplate}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--analysis-primary)' }}
            >
              Create
            </button>
            <button
              onClick={() => setShowNewTemplate(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/[0.05]"
              style={{ color: 'var(--analysis-text)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates */}
      <h2 className="text-sm font-semibold mb-3 opacity-60" style={{ color: 'var(--analysis-text)' }}>Templates</h2>
      {templates.length === 0 ? (
        <p className="text-sm opacity-40 mb-6" style={{ color: 'var(--analysis-text)' }}>No templates yet</p>
      ) : (
        <div className="space-y-2 mb-8">
          {templates.map((t) => (
            <div key={t.id} className="p-4 rounded-xl border border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--analysis-text)' }}>{t.name}</h3>
                {t.description && <p className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--analysis-text)' }}>{t.description}</p>}
              </div>
              <button
                onClick={() => generateReport(t.id)}
                disabled={generating === t.id}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 disabled:opacity-30"
                style={{ backgroundColor: 'var(--analysis-primary)' }}
              >
                {generating === t.id ? 'Generating...' : 'Generate'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Generated Reports */}
      <h2 className="text-sm font-semibold mb-3 opacity-60" style={{ color: 'var(--analysis-text)' }}>Generated Reports</h2>
      {reports.length === 0 ? (
        <p className="text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>No reports generated yet</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="p-4 rounded-xl border border-white/10">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--analysis-text)' }}>{r.title}</h3>
              <p className="text-xs opacity-40 mt-1" style={{ color: 'var(--analysis-text)' }}>
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
