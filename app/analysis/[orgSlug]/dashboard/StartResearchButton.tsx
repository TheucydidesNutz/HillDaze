'use client';

import { useState } from 'react';

export default function StartResearchButton({ profileId }: { profileId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading || done) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/analysis/profiles/${profileId}/research`, {
        method: 'POST',
      });
      if (res.ok) {
        setDone(true);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <span className="text-[10px] text-green-400 px-2 py-0.5 rounded bg-green-500/10">
        Started
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-[10px] font-medium px-2 py-0.5 rounded transition-colors bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-40"
      style={{ color: 'var(--analysis-primary, #3b82f6)' }}
    >
      {loading ? 'Starting...' : 'Research'}
    </button>
  );
}
