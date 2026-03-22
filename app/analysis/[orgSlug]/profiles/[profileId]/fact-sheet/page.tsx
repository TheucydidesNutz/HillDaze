'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, RefreshCw, Phone, Mail, Building2, Globe, GraduationCap,
  Briefcase, Users, ScrollText, DollarSign, Newspaper, ExternalLink,
  ChevronDown, ChevronRight, Plus, Trash2, BookOpen,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FactSheet = Record<string, any>;

interface Note {
  id: string;
  note_text: string;
  created_at: string;
  user_id: string;
}

export default function FactSheetPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const profileId = params.profileId as string;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [factSheet, setFactSheet] = useState<FactSheet | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

  // News items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [newsItems, setNewsItems] = useState<any[]>([]);

  // Polling
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  // Sections
  const [expanded, setExpanded] = useState(true);

  // Fetch org
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/intel/orgs');
        const memberships = await res.json();
        const m = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
        if (m) setOrgId(m.org.id);
      } catch { /* */ }
    })();
  }, [orgSlug]);

  // Fetch fact sheet
  const fetchFactSheet = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/profiles/${profileId}/fact-sheet`);
      if (res.ok) {
        const data = await res.json();
        setFactSheet(data.fact_sheet);
        setGeneratedAt(data.generated_at);
      }
    } catch { /* */ }
    setLoading(false);
  }, [profileId]);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/profiles/${profileId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch { /* */ }
  }, [profileId]);

  // Fetch recent news
  const fetchNews = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/analysis/data-items?profile_id=${profileId}&org_id=${orgId}&category=news&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setNewsItems(data.items || []);
      }
    } catch { /* */ }
  }, [profileId, orgId]);

  useEffect(() => { fetchFactSheet(); fetchNotes(); }, [fetchFactSheet, fetchNotes]);
  useEffect(() => { if (orgId) fetchNews(); }, [orgId, fetchNews]);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), []);

  async function handleGenerate() {
    // Don't clear existing fact sheet — show spinner overlay instead
    setGenerating(true);
    setPollTimedOut(false);
    stopPolling();

    const startedAt = new Date().toISOString();

    try {
      const res = await fetch(`/api/analysis/profiles/${profileId}/fact-sheet`, { method: 'POST' });
      if (!res.ok) {
        setGenerating(false);
        return;
      }

      // POST returns { status: 'queued' } — now poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/analysis/profiles/${profileId}/fact-sheet`);
          if (!pollRes.ok) return;
          const data = await pollRes.json();

          // Check if fact_sheet_generated_at is newer than when we clicked Generate
          if (data.fact_sheet && data.generated_at && data.generated_at > startedAt) {
            stopPolling();
            setFactSheet(data.fact_sheet);
            setGeneratedAt(data.generated_at);
            setGenerating(false);
          }
        } catch { /* keep polling */ }
      }, 3000);

      // Safety timeout — 2 minutes
      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setGenerating(false);
        setPollTimedOut(true);
      }, 120000);

    } catch {
      setGenerating(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/analysis/profiles/${profileId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: newNote.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(prev => [data.note, ...prev]);
        setNewNote('');
      }
    } catch { /* */ }
    setSavingNote(false);
  }

  async function handleDeleteNote(noteId: string) {
    try {
      const res = await fetch(`/api/analysis/profiles/${profileId}/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch { /* */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin opacity-40" style={{ color: 'var(--analysis-text)' }} />
      </div>
    );
  }

  const fs = factSheet;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--analysis-text)' }}>Fact Sheet</h1>
          {generatedAt && (
            <p className="text-xs opacity-40 mt-1" style={{ color: 'var(--analysis-text)' }}>
              Generated {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors disabled:opacity-40"
          style={{ color: 'var(--analysis-text)' }}
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {fs ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {/* Timeout message */}
      {pollTimedOut && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          Generation is taking longer than expected. The page will update when ready.
        </div>
      )}

      {/* No fact sheet state */}
      {!fs && !generating && !pollTimedOut && (
        <div className="text-center py-16 rounded-xl border border-white/10 bg-white/[0.02]" style={{ color: 'var(--analysis-text)' }}>
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm opacity-50 mb-2">No fact sheet generated yet</p>
          <p className="text-xs opacity-30 max-w-md mx-auto">
            Click Generate to create a fact sheet from Congress.gov data and the data lake.
          </p>
        </div>
      )}

      {/* Generating from scratch (no existing data) */}
      {generating && !fs && (
        <div className="text-center py-16 rounded-xl border border-white/10 bg-white/[0.02]" style={{ color: 'var(--analysis-text)' }}>
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
          <p className="text-sm opacity-50">Generating fact sheet...</p>
          <p className="text-xs opacity-30 mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {/* Fact sheet content */}
      {fs && (
        <div className="relative space-y-4">
          {/* Regenerating overlay — shows on top of existing content */}
          {generating && (
            <div className="absolute inset-0 z-10 flex items-start justify-center pt-20 bg-[var(--analysis-bg,#0f0f23)]/70 rounded-xl backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--analysis-primary)' }} />
                <span className="text-sm opacity-70" style={{ color: 'var(--analysis-text)' }}>Regenerating...</span>
              </div>
            </div>
          )}
          {/* Collapsible wrapper */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-2 text-left"
            style={{ color: 'var(--analysis-text)' }}
          >
            {expanded ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
            <span className="text-sm font-semibold opacity-70">Profile Details</span>
          </button>

          {expanded && (
            <div className="space-y-6">
              {/* ── Contact & Office ──────────────────────────── */}
              {(fs.office_phone || fs.office_email || fs.office_address || fs.website_official) && (
                <Section title="Contact & Office" icon={Building2}>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: 'var(--analysis-text)' }}>
                    {fs.office_phone && (
                      <a href={`tel:${fs.office_phone}`} className="inline-flex items-center gap-1.5 opacity-70 hover:opacity-100">
                        <Phone className="w-3.5 h-3.5" /> {fs.office_phone}
                      </a>
                    )}
                    {fs.office_email && (
                      <a href={fs.office_email.startsWith('http') ? fs.office_email : `mailto:${fs.office_email}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 opacity-70 hover:opacity-100">
                        <Mail className="w-3.5 h-3.5" /> {fs.office_email.startsWith('http') ? 'Contact Form' : fs.office_email}
                      </a>
                    )}
                    {fs.office_address && (
                      <span className="inline-flex items-center gap-1.5 opacity-70">
                        <Building2 className="w-3.5 h-3.5" /> {fs.office_address}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {fs.website_official && (
                      <ExtLink href={fs.website_official} label={fs.website_official.replace(/https?:\/\/(www\.)?/, '').replace(/\/$/, '')} />
                    )}
                    {fs.website_campaign && (
                      <ExtLink href={fs.website_campaign} label={fs.website_campaign.replace(/https?:\/\/(www\.)?/, '').replace(/\/$/, '')} />
                    )}
                  </div>
                </Section>
              )}

              {/* ── Role ─────────────────────────────────────── */}
              {fs.current_role && (
                <Section title="Role" icon={Briefcase}>
                  <p className="text-sm font-medium" style={{ color: 'var(--analysis-text)' }}>
                    {fs.current_role} {fs.party ? `(${fs.party})` : ''}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs opacity-50" style={{ color: 'var(--analysis-text)' }}>
                    {fs.service_start_date && <span>Serving since {fs.service_start_date}</span>}
                    {fs.years_serving && <span>{fs.years_serving} years</span>}
                    {fs.term_expires && <span>Term expires: {fs.term_expires}</span>}
                    {fs.next_election && <span>Next election: {fs.next_election}</span>}
                  </div>
                </Section>
              )}

              {/* ── Bio ──────────────────────────────────────── */}
              {fs.short_bio && (
                <Section title="Biography" icon={Users}>
                  <p className="text-sm opacity-80 leading-relaxed" style={{ color: 'var(--analysis-text)' }}>{fs.short_bio}</p>
                </Section>
              )}

              {/* ── Education ────────────────────────────────── */}
              {fs.education && fs.education.length > 0 && (
                <Section title="Education" icon={GraduationCap}>
                  <ul className="space-y-1">
                    {fs.education.map((e: string, i: number) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2" style={{ color: 'var(--analysis-text)' }}>
                        <span className="opacity-40 mt-0.5">&#8226;</span> {e}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* ── Career ───────────────────────────────────── */}
              {fs.cv_bullets && fs.cv_bullets.length > 0 && (
                <Section title="Career" icon={Briefcase}>
                  <ul className="space-y-1">
                    {fs.cv_bullets.map((b: string, i: number) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2" style={{ color: 'var(--analysis-text)' }}>
                        <span className="opacity-40 mt-0.5">&#8226;</span> {b}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* ── Committees ────────────────────────────────── */}
              {fs.committees && fs.committees.length > 0 && (
                <Section title="Committees" icon={Users}>
                  <ul className="space-y-1">
                    {fs.committees.map((c: { name: string; role?: string }, i: number) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2" style={{ color: 'var(--analysis-text)' }}>
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {c.name}{c.role ? ` (${c.role})` : ''}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* ── Bills — Current Session ───────────────────── */}
              {((fs.bills_sponsored_current_session && fs.bills_sponsored_current_session.length > 0) || (fs.amendments_current_session && fs.amendments_current_session.length > 0)) && (
                <Section title="Legislation — 119th Congress" icon={ScrollText}>
                  {/* Bills */}
                  {fs.bills_sponsored_current_session && fs.bills_sponsored_current_session.length > 0 && (
                    <>
                      <ul className="space-y-2">
                        {fs.bills_sponsored_current_session.slice(0, 8).map((b: { number: string; title: string; status: string; url?: string; date?: string }, i: number) => (
                          <li key={i} className="text-sm" style={{ color: 'var(--analysis-text)' }}>
                            <div className="flex items-start gap-2">
                              <span className="font-mono text-xs opacity-50 shrink-0 mt-0.5">{b.number}</span>
                              <div className="min-w-0">
                                {b.url ? (
                                  <a href={b.url} target="_blank" rel="noopener noreferrer"
                                    className="hover:underline" style={{ color: 'var(--analysis-primary)' }}>
                                    {b.title}
                                  </a>
                                ) : (
                                  <span className="opacity-80">{b.title}</span>
                                )}
                                <div className="text-xs opacity-40 mt-0.5">
                                  {b.status}{b.date ? ` — ${b.date}` : ''}
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {fs.bills_sponsored_current_session.length > 8 && (
                        <p className="text-xs mt-2 opacity-40" style={{ color: 'var(--analysis-text)' }}>
                          + {fs.bills_sponsored_current_session.length - 8} more bills
                        </p>
                      )}
                    </>
                  )}

                  {/* Amendments — compact list */}
                  {fs.amendments_current_session && fs.amendments_current_session.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <span className="text-[10px] uppercase tracking-wider opacity-40 font-medium" style={{ color: 'var(--analysis-text)' }}>
                        Amendments ({fs.amendments_current_session.length})
                      </span>
                      <p className="text-xs opacity-50 mt-1 leading-relaxed" style={{ color: 'var(--analysis-text)' }}>
                        {(fs.amendments_current_session as string[]).join(', ')}
                      </p>
                    </div>
                  )}
                </Section>
              )}

              {/* ── PAC & Donors ──────────────────────────────── */}
              {((fs.pac_affiliations && fs.pac_affiliations.length > 0) || (fs.top_donors && fs.top_donors.length > 0)) && (
                <Section title="PAC & Donors" icon={DollarSign}>
                  {fs.pac_affiliations?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] uppercase tracking-wider opacity-40 font-medium" style={{ color: 'var(--analysis-text)' }}>PAC Affiliations</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {fs.pac_affiliations.map((p: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded text-xs bg-white/[0.06] border border-white/10" style={{ color: 'var(--analysis-text)' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {fs.top_donors?.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider opacity-40 font-medium" style={{ color: 'var(--analysis-text)' }}>Top Donors/Industries</span>
                      <ul className="mt-1 space-y-0.5">
                        {fs.top_donors.map((d: string, i: number) => (
                          <li key={i} className="text-sm opacity-70" style={{ color: 'var(--analysis-text)' }}>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Section>
              )}

              {/* ── In the News ───────────────────────────────── */}
              {newsItems.length > 0 && (
                <Section title={`In the News (${newsItems.length})`} icon={Newspaper}>
                  <ul className="space-y-2">
                    {newsItems.map((item) => (
                      <li key={item.id} className="text-sm" style={{ color: 'var(--analysis-text)' }}>
                        <div className="flex items-start gap-2">
                          <span className="opacity-40 mt-0.5 shrink-0">&#8226;</span>
                          <div className="min-w-0">
                            {item.source_url ? (
                              <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                                className="hover:underline opacity-80" style={{ color: 'var(--analysis-primary)' }}>
                                {item.title}
                              </a>
                            ) : (
                              <span className="opacity-80">{item.title}</span>
                            )}
                            <div className="text-xs opacity-40 mt-0.5">
                              {item.source_name}{item.item_date ? ` — ${new Date(item.item_date).toLocaleDateString()}` : ''}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────── */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold opacity-70" style={{ color: 'var(--analysis-text)' }}>My Notes</h3>
            </div>

            {/* Add note */}
            <div className="flex gap-2 mb-4">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note about this profile..."
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent resize-none"
                style={{ color: 'var(--analysis-text)' }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !newNote.trim()}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 self-end"
                style={{ backgroundColor: 'var(--analysis-primary)', color: '#fff' }}
              >
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>

            {/* Notes list */}
            {notes.length > 0 && (
              <div>
                {!showAllNotes && notes.length > 2 && (
                  <button
                    onClick={() => setShowAllNotes(true)}
                    className="text-xs mb-3 hover:underline"
                    style={{ color: 'var(--analysis-primary)' }}
                  >
                    Read My Notebook ({notes.length} notes)
                  </button>
                )}
                <div className="space-y-2">
                  {(showAllNotes ? notes : notes.slice(0, 2)).map(note => (
                    <div key={note.id} className="group px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm opacity-80 whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--analysis-text)' }}>
                          {note.note_text}
                        </p>
                        <p className="text-[10px] opacity-30 mt-1" style={{ color: 'var(--analysis-text)' }}>
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-red-400 shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {showAllNotes && notes.length > 2 && (
                  <button
                    onClick={() => setShowAllNotes(false)}
                    className="text-xs mt-2 hover:underline"
                    style={{ color: 'var(--analysis-primary)' }}
                  >
                    Collapse
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Building2; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 opacity-40" style={{ color: 'var(--analysis-text)' }} />
        <span className="text-[11px] uppercase tracking-wider font-semibold opacity-50" style={{ color: 'var(--analysis-text)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href.startsWith('http') ? href : `https://${href}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs hover:underline"
      style={{ color: 'var(--analysis-primary)' }}
    >
      <Globe className="w-3 h-3" /> {label}
    </a>
  );
}
