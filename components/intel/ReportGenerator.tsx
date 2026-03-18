'use client';

import { useState } from 'react';

const REPORT_TYPES = [
  { value: 'monthly_summary', label: 'Monthly Summary' },
  { value: 'quarterly_review', label: 'Quarterly Review' },
  { value: 'executive_briefing', label: 'Executive Briefing' },
];

export default function ReportGenerator({ orgId, onGenerated }: { orgId: string; onGenerated: () => void }) {
  const [type, setType] = useState('monthly_summary');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  async function handleGenerate() {
    setGenerating(true);
    setMessage('');
    const res = await fetch('/api/intel/agent/monthly-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, month, report_type: type }),
    });
    if (res.ok) {
      setMessage('Report generated successfully');
      onGenerated();
    } else {
      setMessage('Generation failed');
    }
    setGenerating(false);
  }

  return (
    <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--intel-text)' }}>Generate Report</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>Report Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
            {REPORT_TYPES.map(t => <option key={t.value} value={t.value} className="bg-gray-900">{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>Period</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
        </div>
        <div className="flex items-end">
          <button onClick={handleGenerate} disabled={generating} className="w-full px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--intel-primary)' }}>
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {message && <p className="text-xs" style={{ color: 'var(--intel-primary)' }}>{message}</p>}
    </div>
  );
}
