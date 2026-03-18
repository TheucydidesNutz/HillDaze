'use client';

import { useState } from 'react';

const STATUSES = ['new', 'acknowledged', 'in_progress', 'completed', 'dismissed'] as const;
const priorityColors: Record<string, string> = { high: 'bg-red-500/20 text-red-300', medium: 'bg-yellow-500/20 text-yellow-300', low: 'bg-green-500/20 text-green-300' };
const statusColors: Record<string, string> = { new: 'bg-blue-500/20 text-blue-300', acknowledged: 'bg-purple-500/20 text-purple-300', in_progress: 'bg-yellow-500/20 text-yellow-300', completed: 'bg-green-500/20 text-green-300', dismissed: 'bg-gray-500/20 text-gray-400' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StrategicCard({ rec, onStatusChange }: { rec: any; onStatusChange: (id: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const now = new Date();
  const deadline = rec.deadline ? new Date(rec.deadline) : null;
  const daysUntil = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const deadlineClass = daysUntil != null && daysUntil <= 14 ? 'text-red-400' : daysUntil != null && daysUntil <= 30 ? 'text-yellow-400' : '';

  function cycleStatus() {
    const idx = STATUSES.indexOf(rec.status);
    const next = STATUSES[Math.min(idx + 1, STATUSES.length - 1)];
    if (next !== rec.status) onStatusChange(rec.id, next);
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--intel-text)' }}>{rec.title}</h3>
          <div className="flex gap-1.5 shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityColors[rec.priority] || ''}`}>{rec.priority}</span>
            <button onClick={cycleStatus} className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 ${statusColors[rec.status] || ''}`}>{rec.status?.replace('_', ' ')}</button>
          </div>
        </div>

        <p className="text-xs opacity-70 mb-2" style={{ color: 'var(--intel-text)' }}>{rec.description}</p>

        {deadline && (
          <p className={`text-xs mb-2 ${deadlineClass}`}>
            Deadline: {rec.deadline}{daysUntil != null ? ` (${daysUntil} days)` : ''}
          </p>
        )}

        <button onClick={() => setExpanded(!expanded)} className="text-[10px] opacity-40 hover:opacity-70" style={{ color: 'var(--intel-text)' }}>
          {expanded ? 'Hide details' : 'Show details'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            {rec.action_steps?.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Action Steps</h4>
                <ol className="space-y-1">{rec.action_steps.map((s: string, i: number) => (
                  <li key={i} className="text-xs opacity-70 flex gap-2" style={{ color: 'var(--intel-text)' }}><span className="opacity-40">{i + 1}.</span>{s}</li>
                ))}</ol>
              </div>
            )}
            {rec.rationale && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Rationale</h4>
                <p className="text-xs opacity-70" style={{ color: 'var(--intel-text)' }}>{rec.rationale}</p>
              </div>
            )}
            {rec.related_stakeholders?.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--intel-text)' }}>Related Stakeholders</h4>
                <p className="text-xs opacity-70" style={{ color: 'var(--intel-text)' }}>{rec.related_stakeholders.join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
