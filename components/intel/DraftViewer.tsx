'use client';

import MarkdownRenderer from './MarkdownRenderer';

export default function DraftViewer({
  title,
  draft,
  onClose,
}: {
  title: string;
  draft: string;
  onClose: () => void;
}) {
  function copyToClipboard() {
    navigator.clipboard.writeText(draft);
  }

  function downloadMd() {
    const blob = new Blob([draft], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-3xl rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'var(--intel-bg)' }}>
        <div className="sticky top-0 z-10 border-b border-white/10 px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--intel-bg)' }}>
          <h2 className="text-lg font-semibold truncate" style={{ color: 'var(--intel-text)' }}>{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={copyToClipboard} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>Copy</button>
            <button onClick={downloadMd} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>Download .md</button>
            <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>Close</button>
          </div>
        </div>
        <div className="px-6 py-6">
          <MarkdownRenderer content={draft} />
        </div>
      </div>
    </div>
  );
}
