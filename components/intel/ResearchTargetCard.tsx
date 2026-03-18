'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ResearchTargetCard({ target, orgSlug }: { target: any; orgSlug: string }) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-300',
    paused: 'bg-yellow-500/20 text-yellow-300',
    archived: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <Link href={`/intel/${orgSlug}/research/${target.slug}`}>
      <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="shrink-0 opacity-60" style={{ color: 'var(--intel-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--intel-text)' }}>{target.name}</h3>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${statusColors[target.status] || ''}`}>
            {target.status}
          </span>
        </div>

        <p className="text-xs opacity-60 mb-3 line-clamp-2" style={{ color: 'var(--intel-text)' }}>
          {target.description}
        </p>

        <div className="flex items-center gap-4 text-[10px] opacity-40" style={{ color: 'var(--intel-text)' }}>
          <span>{target.doc_count || 0} docs</span>
          <span>{target.news_count || 0} news</span>
          {target.last_summary && (
            <span>Summary v{target.last_summary.version}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
