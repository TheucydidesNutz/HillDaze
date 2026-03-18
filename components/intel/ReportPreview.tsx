'use client';

import MarkdownRenderer from './MarkdownRenderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ReportPreview({ report, onClose }: { report: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-3xl rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'var(--intel-bg)' }}>
        <div className="sticky top-0 z-10 border-b border-white/10 px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--intel-bg)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--intel-text)' }}>
            Report — {report.month}
          </h2>
          <div className="flex gap-2">
            {report.docx_storage_path && (
              <a href={`/api/intel/reports/${report.id}/download`} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>
                Download .docx
              </a>
            )}
            <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>Close</button>
          </div>
        </div>
        <div className="px-6 py-6">
          <MarkdownRenderer content={report.content} />
        </div>
      </div>
    </div>
  );
}
