'use client';

import { useState, useEffect, useCallback } from 'react';

const EVENT_COLORS: Record<string, string> = {
  comment_period: 'bg-blue-500', comment_period_close: 'bg-blue-500',
  hearing: 'bg-purple-500', vote: 'bg-red-500',
  rulemaking: 'bg-orange-500', filing_deadline: 'bg-yellow-500',
  custom: 'bg-gray-500', agent_extracted: 'bg-cyan-500',
};

const TYPE_BADGES: Record<string, string> = {
  comment_period: 'bg-blue-500/20 text-blue-300', comment_period_close: 'bg-blue-500/20 text-blue-300',
  hearing: 'bg-purple-500/20 text-purple-300', vote: 'bg-red-500/20 text-red-300',
  rulemaking: 'bg-orange-500/20 text-orange-300', filing_deadline: 'bg-yellow-500/20 text-yellow-300',
  custom: 'bg-gray-500/20 text-gray-300',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function CalendarView({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', event_type: 'custom', event_date: '', end_date: '', description: '', action_needed: '' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selected, setSelected] = useState<any>(null);

  const fetchEvents = useCallback(async () => {
    const res = await fetch(`/api/intel/calendar?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/intel/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, ...form }),
    });
    setShowForm(false);
    setForm({ title: '', event_type: 'custom', event_date: '', end_date: '', description: '', action_needed: '' });
    fetchEvents();
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/intel/calendar/${id}`, { method: 'DELETE' });
    setSelected(null);
    fetchEvents();
  }

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.event_date) >= now);
  const past = events.filter(e => new Date(e.event_date) < now);

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>{upcoming.length} upcoming, {past.length} past</p>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>
            {showForm ? 'Cancel' : 'Add Event'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={addEvent} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] grid grid-cols-1 md:grid-cols-2 gap-3">
          <input required placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
          <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
            {['comment_period', 'hearing', 'vote', 'rulemaking', 'filing_deadline', 'custom'].map(t => <option key={t} value={t} className="bg-gray-900">{t.replace('_', ' ')}</option>)}
          </select>
          <input required type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
          <input type="date" placeholder="End date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
          <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white md:col-span-2" />
          <input placeholder="Action needed" value={form.action_needed} onChange={e => setForm({ ...form, action_needed: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white" />
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Add</button>
        </form>
      )}

      {/* Event list */}
      <div className="space-y-2">
        {upcoming.length === 0 && past.length === 0 ? (
          <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>No calendar events yet.</div>
        ) : (
          <>
            {upcoming.map(e => {
              const days = Math.ceil((new Date(e.event_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isImminent = days <= 14;
              return (
                <div key={e.id} onClick={() => setSelected(selected?.id === e.id ? null : e)}
                  className={`px-4 py-3 rounded-lg border cursor-pointer transition-colors ${isImminent ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-white/[0.02]'} hover:bg-white/[0.04]`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${EVENT_COLORS[e.event_type] || 'bg-gray-500'}`} />
                    <span className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>{e.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ml-auto ${TYPE_BADGES[e.event_type] || 'bg-white/10 text-white/60'}`}>{e.event_type?.replace('_', ' ')}</span>
                    <span className={`text-xs ${isImminent ? 'text-red-400 font-medium' : 'opacity-40'}`} style={isImminent ? {} : { color: 'var(--intel-text)' }}>{e.event_date} ({days}d)</span>
                  </div>
                  {selected?.id === e.id && (
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                      {e.description && <p className="text-xs opacity-60" style={{ color: 'var(--intel-text)' }}>{e.description}</p>}
                      {e.action_needed && <p className="text-xs" style={{ color: 'var(--intel-primary)' }}>Action: {e.action_needed}</p>}
                      <p className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>Source: {e.source_type}</p>
                      {isAdmin && <button onClick={(ev) => { ev.stopPropagation(); deleteEvent(e.id); }} className="text-xs text-red-400/60 hover:text-red-400">Delete</button>}
                    </div>
                  )}
                </div>
              );
            })}
            {past.length > 0 && (
              <>
                <div className="text-xs opacity-30 pt-4" style={{ color: 'var(--intel-text)' }}>Past Events</div>
                {past.slice(0, 10).map(e => (
                  <div key={e.id} className="px-4 py-2 rounded-lg border border-white/5 opacity-40">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${EVENT_COLORS[e.event_type] || 'bg-gray-500'} opacity-50`} />
                      <span className="text-sm" style={{ color: 'var(--intel-text)' }}>{e.title}</span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--intel-text)' }}>{e.event_date}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
