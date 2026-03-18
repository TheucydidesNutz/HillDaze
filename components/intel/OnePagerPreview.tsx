'use client';

import type { OnePagerContent } from '@/lib/intel/reports/generate-one-pager-docx';

export default function OnePagerPreview({
  content,
  orgName,
}: {
  content: OnePagerContent;
  orgName?: string;
}) {
  return (
    <div
      className="bg-white text-gray-900 rounded-xl shadow-lg overflow-hidden"
      style={{ maxWidth: '8.5in', minHeight: '11in', padding: '0.75in', fontSize: '10.5pt', lineHeight: '1.4' }}
    >
      {/* Header bar */}
      {orgName && (
        <div className="pb-2 mb-4" style={{ borderBottom: '2px solid var(--intel-primary, #3b82f6)' }}>
          <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--intel-primary, #3b82f6)' }}>
            {orgName}
          </span>
        </div>
      )}

      {/* Headline */}
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--intel-primary, #3b82f6)' }}>
        {content.headline || 'Headline'}
      </h1>

      {/* Subheadline */}
      <p className="text-sm italic text-gray-500 mb-4">
        {content.subheadline || 'Subheadline'}
      </p>

      {/* THE ISSUE */}
      <SectionHeader text="THE ISSUE" />
      <p className="mb-3 text-sm">{content.the_issue || '...'}</p>

      {/* OUR POSITION */}
      <SectionHeader text="OUR POSITION" />
      <p className="mb-3 text-sm">{content.our_position || '...'}</p>

      {/* KEY POINTS */}
      <SectionHeader text="KEY POINTS" />
      <ul className="mb-3 space-y-1">
        {(content.key_points || []).map((point, i) => (
          <li key={i} className="text-sm flex gap-2">
            <span className="font-bold" style={{ color: 'var(--intel-primary, #3b82f6)' }}>&#x2022;</span>
            {point}
          </li>
        ))}
      </ul>

      {/* Pullout stat */}
      {content.pullout_stat?.number && (
        <div className="my-4 p-4 rounded-lg text-center" style={{ backgroundColor: '#F0F4F8' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--intel-primary, #3b82f6)' }}>
            {content.pullout_stat.number}
          </div>
          <div className="text-xs text-gray-500 mt-1">{content.pullout_stat.context}</div>
        </div>
      )}

      {/* THE ASK */}
      <SectionHeader text="THE ASK" />
      <p className="mb-4 text-sm font-bold">{content.the_ask || '...'}</p>

      {/* Contact */}
      {content.contact?.name && (
        <div className="pt-2 mt-4" style={{ borderTop: '1px solid var(--intel-primary, #3b82f6)' }}>
          <p className="text-xs text-gray-400">
            {[content.contact.name, content.contact.title, content.contact.email, content.contact.phone].filter(Boolean).join('  |  ')}
          </p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ text }: { text: string }) {
  return (
    <h3
      className="text-xs font-bold uppercase tracking-wider mb-1 pb-0.5"
      style={{ color: 'var(--intel-primary, #3b82f6)', borderBottom: '1px solid var(--intel-primary, #3b82f6)' }}
    >
      {text}
    </h3>
  );
}
