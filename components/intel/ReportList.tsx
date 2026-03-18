'use client';

import { useState, useEffect, useCallback } from 'react';
import ReportGenerator from './ReportGenerator';
import ReportPreview from './ReportPreview';

export default function ReportList({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewing, setPreviewing] = useState<any>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const fetchReports = useCallback(async () => {
    const res = await fetch(`/api/intel/reports?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) setReports(await res.json());
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>{reports.length} report{reports.length !== 1 ? 's' : ''}</p>
        {isAdmin && (
          <button onClick={() => setShowGenerator(!showGenerator)} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>
            {showGenerator ? 'Hide Generator' : 'Generate Report'}
          </button>
        )}
      </div>

      {showGenerator && isAdmin && (
        <div className="mb-6">
          <ReportGenerator orgId={orgId} onGenerated={() => { fetchReports(); setShowGenerator(false); }} />
        </div>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          No reports generated yet.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between hover:bg-white/[0.04] transition-colors">
              <div>
                <h3 className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>
                  {new Date(r.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>{r.status}</span>
                  <span className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>
                    Generated {new Date(r.generated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreviewing(r)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>Preview</button>
                {r.docx_storage_path && (
                  <a href={`/api/intel/reports/${r.id}/download`} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Download</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewing && <ReportPreview report={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}
