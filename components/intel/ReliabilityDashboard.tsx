'use client';

import { useState, useEffect, useCallback } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ReliabilityDashboard({ orgId }: { orgId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [message, setMessage] = useState('');

  const fetchScores = useCallback(async () => {
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  async function runScoring() {
    setScoring(true);
    setMessage('');
    const res = await fetch('/api/intel/agent/score-reliability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setScores(data);
      setMessage(`Scored ${data.length} members`);
    }
    setScoring(false);
  }

  function scoreColor(s: number) { return s >= 0.7 ? 'text-green-400' : s >= 0.4 ? 'text-yellow-400' : 'text-red-400'; }
  function scoreBg(s: number) { return s >= 0.7 ? 'bg-green-500' : s >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'; }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          User reliability assessment — super_admin only
        </p>
        <button onClick={runScoring} disabled={scoring} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: 'var(--intel-primary)' }}>
          {scoring ? 'Scoring...' : 'Run Scoring'}
        </button>
      </div>

      {message && <div className="p-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm" style={{ color: 'var(--intel-primary)' }}>{message}</div>}

      {scores.length === 0 ? (
        <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
          Click &ldquo;Run Scoring&rdquo; to assess team member reliability.
        </div>
      ) : (
        <div className="space-y-3">
          {scores.map((s: { user: string; score?: number; error?: string }, i: number) => (
            <div key={i} className="px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>{s.user}</span>
                {s.score != null ? (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreBg(s.score)}`} style={{ width: `${s.score * 100}%` }} />
                    </div>
                    <span className={`text-sm font-bold ${scoreColor(s.score)}`}>{(s.score * 100).toFixed(0)}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-red-400">{s.error || 'No score'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
