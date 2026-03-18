'use client';

import { useState, useEffect } from 'react';

export default function FocusAreaList({ orgId }: { orgId: string }) {
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intel/soul-document?orgId=${orgId}`, { cache: 'no-store' });
      if (res.ok) {
        const doc = await res.json();
        if (doc?.content) {
          // Parse Priority Policy Areas section
          const match = doc.content.match(/## Priority Policy Areas\s*\n([\s\S]*?)(?=\n## |$)/);
          if (match) {
            const items = match[1]
              .split('\n')
              .map((l: string) => l.replace(/^\d+\.\s*/, '').trim())
              .filter(Boolean);
            setFocusAreas(items);
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [orgId]);

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div>
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--intel-text)' }}>Current Focus Areas</h2>
      {focusAreas.length === 0 ? (
        <p className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>No focus areas found in the soul document.</p>
      ) : (
        <ol className="space-y-2">
          {focusAreas.map((area, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-white/5 bg-white/[0.02]">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                style={{ backgroundColor: `var(--intel-primary)`, color: 'white', opacity: 1 - i * 0.15 }}
              >
                {i + 1}
              </span>
              <span className="text-sm" style={{ color: 'var(--intel-text)' }}>{area}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
