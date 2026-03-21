'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, AlertCircle, Check, X, ExternalLink, Loader2 } from 'lucide-react';
import type { AnalysisProfile, AnalysisSoulDocument } from '@/lib/analysis/types';

// ── Types for soul document content ──────────────────────────────────

interface CitationObject {
  quote?: string;
  source_item_id?: string;
}

type Citation = string | CitationObject;

interface SoulMeta {
  person_name?: string;
  title?: string;
  party?: string;
  last_updated?: string;
  data_item_count?: number;
  confidence_level?: 'low' | 'medium' | 'high';
}

interface CommunicationStyle {
  overall_tone?: string;
  vocabulary_level?: string;
  rhetorical_devices?: string[];
  sentence_patterns?: string;
  humor_style?: string;
  signature_phrases?: string[];
  differences_by_medium?: Record<string, string>;
  source_citations?: Citation[];
}

interface TopIssue {
  topic: string;
  position?: string;
  intensity?: string;
  evolution?: string;
  key_quotes?: string[];
  source_citations?: Citation[];
}

interface OppositionItem {
  topic: string;
  position?: string;
  source_citations?: Citation[];
}

interface Priorities {
  top_issues?: TopIssue[];
  secondary_issues?: string[];
  known_opposition?: (string | OppositionItem)[];
  source_citations?: Citation[];
}

interface VotingPatternSummary {
  party_alignment?: string;
  breakaway_areas?: string[];
  bipartisan_collaborations?: string[];
  source_citations?: Citation[];
}

interface PersonalTouchstones {
  background?: string;
  education?: string;
  family_references?: string;
  hobbies_interests?: string;
  source_citations?: Citation[];
}

interface DonationNetworkSummary {
  top_donors_by_sector?: string[];
  top_recipients_of_personal_donations?: string[];
  pac_affiliations?: string[];
  source_citations?: Citation[];
}

interface SocialMediaHabits {
  platform?: string;
  frequency?: string;
  tone?: string;
  common_topics?: string[];
}

interface MediaPresence {
  preferred_outlets?: string[];
  podcast_appearances?: string[];
  social_media_habits?: SocialMediaHabits;
  source_citations?: Citation[];
}

interface HowToCommunicate {
  dos?: string[];
  donts?: string[];
  best_approach_by_context?: Record<string, string>;
  source_citations?: Citation[];
}

interface SoulContent {
  meta?: SoulMeta;
  communication_style?: CommunicationStyle;
  priorities?: Priorities;
  voting_pattern_summary?: VotingPatternSummary;
  personal_touchstones?: PersonalTouchstones;
  donation_network_summary?: DonationNetworkSummary;
  media_presence?: MediaPresence;
  how_to_communicate_with_them?: HowToCommunicate;
}

// ── Props ────────────────────────────────────────────────────────────

interface VoiceViewerProps {
  profile: AnalysisProfile;
  soulDocument: AnalysisSoulDocument | null;
  orgSlug: string;
  verifiedItemCount: number;
  pendingProposalCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Safely convert any jsonb value to a renderable string — handles citation objects, etc. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if ('quote' in val && val.quote) return String(val.quote);
    if ('source_item_id' in val) return String(val.source_item_id);
    return JSON.stringify(val);
  }
  return String(val);
}

function partyBadge(party: string | null) {
  if (!party) return null;
  const p = party.toUpperCase();
  let bg = 'bg-slate-500/20';
  let text = 'text-slate-400';
  let label = party;

  if (p === 'R' || p === 'REPUBLICAN') {
    bg = 'bg-red-500/20'; text = 'text-red-400'; label = 'R';
  } else if (p === 'D' || p === 'DEMOCRAT' || p === 'DEMOCRATIC') {
    bg = 'bg-blue-500/20'; text = 'text-blue-400'; label = 'D';
  } else if (p === 'I' || p === 'INDEPENDENT') {
    bg = 'bg-yellow-500/20'; text = 'text-yellow-400'; label = 'I';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text}`}>
      {label}
    </span>
  );
}

function confidenceBadge(level?: string) {
  if (!level) return null;
  const config: Record<string, { bg: string; text: string }> = {
    low:    { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    medium: { bg: 'bg-blue-500/20',   text: 'text-blue-400' },
    high:   { bg: 'bg-green-500/20',  text: 'text-green-400' },
  };
  const c = config[level] || config.medium;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)} confidence
    </span>
  );
}

function intensityBadge(intensity?: string) {
  if (!intensity) return null;
  const lower = intensity.toLowerCase();
  let bg = 'bg-amber-500/20';
  let text = 'text-amber-400';
  if (lower.startsWith('high')) { bg = 'bg-red-500/20'; text = 'text-red-400'; }
  else if (lower.startsWith('low')) { bg = 'bg-green-500/20'; text = 'text-green-400'; }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${bg} ${text}`}>
      {intensity}
    </span>
  );
}

function CitationChip({ citation, index }: { citation: Citation; index: number }) {
  const isObj = typeof citation === 'object' && citation !== null;
  const sourceId = isObj ? (citation.source_item_id || '') : String(citation);
  const quote = isObj ? citation.quote : undefined;

  // Truncate source ID for display (UUIDs are long)
  const shortId = sourceId.length > 12 ? sourceId.slice(0, 8) + '...' : sourceId;

  return (
    <span className="relative group/cite inline-flex">
      <span
        className="inline-flex items-center gap-1 min-w-[22px] h-5 px-1.5 rounded text-[10px] font-mono font-medium bg-white/10 cursor-default hover:bg-white/20 transition-colors"
        style={{ color: 'var(--analysis-primary)' }}
      >
        [{index + 1}]
      </span>
      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/cite:block z-50 pointer-events-none">
        <div
          className="rounded-lg border border-white/15 shadow-xl p-2.5 w-64 text-[11px] leading-relaxed"
          style={{ backgroundColor: 'var(--analysis-bg, #0f0f23)', color: 'var(--analysis-text)' }}
        >
          <div className="font-medium opacity-70 mb-1 font-mono text-[10px]">
            Source: {shortId}
          </div>
          {quote && (
            <div className="opacity-50 line-clamp-3 italic">
              &ldquo;{quote.length > 120 ? quote.slice(0, 120) + '...' : quote}&rdquo;
            </div>
          )}
        </div>
      </div>
    </span>
  );
}

function CitationRow({ citations }: { citations?: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-3 mt-3 border-t border-white/5">
      <span className="text-[10px] uppercase tracking-wider opacity-30 mr-1 self-center">Sources</span>
      {citations.map((citation, i) => {
        const key = typeof citation === 'object' && citation !== null
          ? (citation.source_item_id || `citation-${i}`)
          : citation;
        return <CitationChip key={key} citation={citation} index={i} />;
      })}
    </div>
  );
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ── Accordion Section ────────────────────────────────────────────────

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
        style={{ color: 'var(--analysis-text)' }}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
        )}
        <span className="text-sm font-semibold tracking-wide">{title}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4" style={{ color: 'var(--analysis-text)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function VoiceViewer({
  profile,
  soulDocument,
  orgSlug,
  verifiedItemCount,
  pendingProposalCount,
}: VoiceViewerProps) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState(false);

  const content = (soulDocument?.content || {}) as SoulContent;
  const meta = content.meta;
  const commStyle = content.communication_style;
  const priorities = content.priorities;
  const voting = content.voting_pattern_summary;
  const personal = content.personal_touchstones;
  const donations = content.donation_network_summary;
  const media = content.media_presence;
  const howTo = content.how_to_communicate_with_them;

  const isEmpty = !soulDocument || Object.keys(soulDocument.content || {}).length === 0;

  // ── Generate handler ────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    setGenSuccess(false);

    try {
      const res = await fetch(`/api/analysis/voice/${profile.id}/generate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate soul document');
      }
      setGenSuccess(true);
      // Reload page to show fresh data
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p
            className="text-xs uppercase tracking-wider opacity-40 mb-1"
            style={{ color: 'var(--analysis-text)' }}
          >
            Voice Profile
          </p>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--analysis-text)' }}>
            {profile.full_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {profile.title && (
              <span className="text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
                {profile.title}
              </span>
            )}
            {partyBadge(profile.party)}
            {confidenceBadge(meta?.confidence_level)}
            <span
              className="text-xs opacity-40"
              style={{ color: 'var(--analysis-text)' }}
            >
              {verifiedItemCount} verified items
            </span>
            {soulDocument?.last_regenerated_at && (
              <span
                className="text-xs opacity-30"
                style={{ color: 'var(--analysis-text)' }}
              >
                Updated {formatDate(soulDocument.last_regenerated_at)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          style={{ color: 'var(--analysis-text)' }}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              {isEmpty ? 'Generate' : 'Regenerate'}
            </>
          )}
        </button>
      </div>

      {/* ── Gen feedback ────────────────────────────────────────── */}
      {genError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {genError}
        </div>
      )}
      {genSuccess && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          Soul document generated. Reloading...
        </div>
      )}

      {/* ── Pending proposals banner ────────────────────────────── */}
      {pendingProposalCount > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {pendingProposalCount} proposed update{pendingProposalCount !== 1 ? 's' : ''} pending review
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {isEmpty && (
        <div
          className="text-center py-20 rounded-xl border border-white/10 bg-white/[0.02]"
          style={{ color: 'var(--analysis-text)' }}
        >
          <div className="text-4xl opacity-20 mb-4">&#9998;</div>
          <h2 className="text-lg font-semibold mb-2 opacity-70">No soul document generated yet</h2>
          <p className="text-sm opacity-40 mb-6 max-w-md mx-auto">
            Generate a voice profile from the verified data items in this profile&apos;s data lake.
            {verifiedItemCount === 0 && ' You need at least some verified data items first.'}
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--analysis-primary)',
              color: '#fff',
            }}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Generate Now
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Soul Document Sections ──────────────────────────────── */}
      {!isEmpty && (
        <div className="space-y-3">
          {/* ── Communication Style ────────────────────────────── */}
          {commStyle && (
            <AccordionSection title="Communication Style" defaultOpen>
              {commStyle.overall_tone && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Overall Tone</label>
                  <p className="text-sm opacity-80 mt-1 leading-relaxed">{safe(commStyle.overall_tone)}</p>
                </div>
              )}

              {commStyle.vocabulary_level && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Vocabulary Level</label>
                  <p className="text-sm opacity-80 mt-1 leading-relaxed">{safe(commStyle.vocabulary_level)}</p>
                </div>
              )}

              {commStyle.rhetorical_devices && commStyle.rhetorical_devices.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Rhetorical Devices</label>
                  <ul className="mt-1 space-y-1">
                    {commStyle.rhetorical_devices.map((device, i) => (
                      <li key={i} className="text-sm opacity-80 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(device)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {commStyle.sentence_patterns && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Sentence Patterns</label>
                  <p className="text-sm opacity-80 mt-1 leading-relaxed">{safe(commStyle.sentence_patterns)}</p>
                </div>
              )}

              {commStyle.humor_style && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Humor Style</label>
                  <p className="text-sm opacity-80 mt-1 leading-relaxed">{safe(commStyle.humor_style)}</p>
                </div>
              )}

              {commStyle.signature_phrases && commStyle.signature_phrases.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Signature Phrases</label>
                  <div className="mt-2 space-y-2">
                    {commStyle.signature_phrases.map((phrase, i) => (
                      <blockquote
                        key={i}
                        className="pl-4 py-2 text-sm italic opacity-80 leading-relaxed"
                        style={{ borderLeft: '3px solid var(--analysis-primary)' }}
                      >
                        {safe(phrase)}
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}

              {commStyle.differences_by_medium && Object.keys(commStyle.differences_by_medium).length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Differences by Medium</label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(commStyle.differences_by_medium).map(([medium, desc]) => (
                      <div
                        key={medium}
                        className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                      >
                        <span className="text-xs font-semibold capitalize" style={{ color: 'var(--analysis-primary)' }}>
                          {medium.replace(/_/g, ' ')}
                        </span>
                        <p className="text-sm opacity-70 mt-1 leading-relaxed">{safe(desc)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <CitationRow citations={commStyle.source_citations} />
            </AccordionSection>
          )}

          {/* ── Priorities ─────────────────────────────────────── */}
          {priorities && (
            <AccordionSection title="Priorities" defaultOpen>
              {/* Top issues */}
              {priorities.top_issues && priorities.top_issues.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Top Issues</label>
                  <div className="mt-2 space-y-3">
                    {priorities.top_issues.map((issue, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-bold" style={{ color: 'var(--analysis-text)' }}>
                            {safe(issue.topic)}
                          </span>
                          {intensityBadge(safe(issue.intensity))}
                        </div>
                        {issue.position && (
                          <p className="text-sm opacity-70 leading-relaxed">{safe(issue.position)}</p>
                        )}
                        {issue.evolution && (
                          <p className="text-xs opacity-50 italic">{safe(issue.evolution)}</p>
                        )}
                        {issue.key_quotes && issue.key_quotes.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {issue.key_quotes.map((quote, qi) => (
                              <blockquote
                                key={qi}
                                className="pl-3 py-1 text-sm italic opacity-70 leading-relaxed"
                                style={{ borderLeft: '2px solid var(--analysis-primary)' }}
                              >
                                &ldquo;{safe(quote)}&rdquo;
                              </blockquote>
                            ))}
                          </div>
                        )}
                        <CitationRow citations={issue.source_citations} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Secondary issues */}
              {priorities.secondary_issues && priorities.secondary_issues.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Secondary Issues</label>
                  <ul className="mt-1 space-y-1">
                    {priorities.secondary_issues.map((issue, i) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(issue)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Known opposition — data can be string[] or OppositionItem[] */}
              {priorities.known_opposition && priorities.known_opposition.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Known Opposition</label>
                  <div className="mt-2 space-y-2">
                    {priorities.known_opposition.map((opp, i) => {
                      const isString = typeof opp === 'string';
                      const label = isString ? opp : (opp.topic || safe(opp));
                      const position = isString ? undefined : opp.position;
                      const citations = isString ? undefined : opp.source_citations;
                      return (
                        <div
                          key={i}
                          className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                          style={{ borderLeftWidth: '3px', borderLeftColor: '#ef4444' }}
                        >
                          <span className="text-sm font-semibold" style={{ color: 'var(--analysis-text)' }}>
                            {safe(label)}
                          </span>
                          {position && (
                            <p className="text-sm opacity-70 mt-1 leading-relaxed">{safe(position)}</p>
                          )}
                          <CitationRow citations={citations} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <CitationRow citations={priorities.source_citations} />
            </AccordionSection>
          )}

          {/* ── How to Communicate ─────────────────────────────── */}
          {howTo && (
            <AccordionSection title="How to Communicate" defaultOpen>
              {/* Do / Don't split layout */}
              {(howTo.dos || howTo.donts) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* DO column */}
                  {howTo.dos && howTo.dos.length > 0 && (
                    <div className="rounded-lg border border-green-500/20 bg-green-500/[0.04] p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-green-400 mb-3">Do</h4>
                      <ul className="space-y-2">
                        {howTo.dos.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm opacity-80">
                            <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                            <span>{safe(item)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* DON'T column */}
                  {howTo.donts && howTo.donts.length > 0 && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-3">Don&apos;t</h4>
                      <ul className="space-y-2">
                        {howTo.donts.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm opacity-80">
                            <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <span>{safe(item)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Best approach by context */}
              {howTo.best_approach_by_context && Object.keys(howTo.best_approach_by_context).length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Best Approach by Context</label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(howTo.best_approach_by_context).map(([context, advice]) => (
                      <div
                        key={context}
                        className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                      >
                        <span className="text-xs font-semibold capitalize" style={{ color: 'var(--analysis-primary)' }}>
                          {context.replace(/_/g, ' ')}
                        </span>
                        <p className="text-sm opacity-70 mt-1 leading-relaxed">{safe(advice)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <CitationRow citations={howTo.source_citations} />
            </AccordionSection>
          )}

          {/* ── Voting Patterns ─────────────────────────────────── */}
          {voting && (
            <AccordionSection title="Voting Patterns">
              {voting.party_alignment && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Party Alignment</label>
                  <p className="text-sm opacity-80 mt-1 font-medium">{safe(voting.party_alignment)}</p>
                </div>
              )}

              {voting.breakaway_areas && voting.breakaway_areas.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Breakaway Areas</label>
                  <ul className="mt-1 space-y-1">
                    {voting.breakaway_areas.map((area, i) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(area)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {voting.bipartisan_collaborations && voting.bipartisan_collaborations.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Bipartisan Collaborations</label>
                  <ul className="mt-1 space-y-1">
                    {voting.bipartisan_collaborations.map((collab, i) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(collab)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <CitationRow citations={voting.source_citations} />
            </AccordionSection>
          )}

          {/* ── Personal Touchstones ───────────────────────────── */}
          {personal && (
            <AccordionSection title="Personal Touchstones">
              {personal.background && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Background</label>
                  <p className="text-sm opacity-80 mt-1 leading-relaxed">{safe(personal.background)}</p>
                </div>
              )}

              {personal.education && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Education</label>
                  <p className="text-sm opacity-80 mt-1 leading-relaxed">{safe(personal.education)}</p>
                </div>
              )}

              {personal.family_references && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Family</label>
                  <p className="text-sm opacity-80 mt-1 leading-relaxed">{safe(personal.family_references)}</p>
                </div>
              )}

              {personal.hobbies_interests && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Hobbies &amp; Interests</label>
                  <p className="text-sm opacity-80 mt-1 leading-relaxed">{safe(personal.hobbies_interests)}</p>
                </div>
              )}

              <CitationRow citations={personal.source_citations} />
            </AccordionSection>
          )}

          {/* ── Donation Network ────────────────────────────────── */}
          {donations && (
            <AccordionSection title="Donation Network">
              {donations.top_donors_by_sector && donations.top_donors_by_sector.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Top Donors by Sector</label>
                  <ul className="mt-1 space-y-1">
                    {donations.top_donors_by_sector.map((donor, i) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(donor)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {donations.top_recipients_of_personal_donations && donations.top_recipients_of_personal_donations.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Personal Donation Recipients</label>
                  <ul className="mt-1 space-y-1">
                    {donations.top_recipients_of_personal_donations.map((r, i) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(r)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {donations.pac_affiliations && donations.pac_affiliations.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">PAC Affiliations</label>
                  <ul className="mt-1 space-y-1">
                    {donations.pac_affiliations.map((pac, i) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(pac)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <CitationRow citations={donations.source_citations} />
            </AccordionSection>
          )}

          {/* ── Media Presence ──────────────────────────────────── */}
          {media && (
            <AccordionSection title="Media Presence">
              {media.preferred_outlets && media.preferred_outlets.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Preferred Outlets</label>
                  <ul className="mt-1 space-y-1">
                    {media.preferred_outlets.map((outlet, i) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(outlet)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {media.podcast_appearances && media.podcast_appearances.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Podcast Appearances</label>
                  <ul className="mt-1 space-y-1">
                    {media.podcast_appearances.map((pod, i) => (
                      <li key={i} className="text-sm opacity-70 flex items-start gap-2">
                        <span className="opacity-40 mt-0.5">&#8226;</span>
                        {safe(pod)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {media.social_media_habits && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider opacity-40 font-medium">Social Media Habits</label>
                  <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                    {media.social_media_habits.platform && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--analysis-primary)' }}>
                          Platform
                        </span>
                        <span className="text-sm opacity-70">{safe(media.social_media_habits.platform)}</span>
                      </div>
                    )}
                    {media.social_media_habits.frequency && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--analysis-primary)' }}>
                          Frequency
                        </span>
                        <span className="text-sm opacity-70">{safe(media.social_media_habits.frequency)}</span>
                      </div>
                    )}
                    {media.social_media_habits.tone && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--analysis-primary)' }}>
                          Tone
                        </span>
                        <span className="text-sm opacity-70">{safe(media.social_media_habits.tone)}</span>
                      </div>
                    )}
                    {media.social_media_habits.common_topics && media.social_media_habits.common_topics.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold" style={{ color: 'var(--analysis-primary)' }}>
                          Common Topics
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {media.social_media_habits.common_topics.map((topic, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-xs bg-white/[0.08] opacity-70"
                            >
                              {safe(topic)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <CitationRow citations={media.source_citations} />
            </AccordionSection>
          )}
        </div>
      )}

      {/* ── Version footer ──────────────────────────────────────── */}
      {soulDocument && !isEmpty && (
        <div
          className="mt-6 text-center text-xs opacity-20"
          style={{ color: 'var(--analysis-text)' }}
        >
          Soul Document v{soulDocument.version} &middot; Last regenerated {formatDate(soulDocument.last_regenerated_at)}
        </div>
      )}
    </div>
  );
}
