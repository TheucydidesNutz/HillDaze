import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import { getOrgProfiles } from '@/lib/analysis/supabase-queries';
import { supabaseAdmin } from '@/lib/supabase';
import type { PositionType, ResearchStatus } from '@/lib/analysis/types';
import type { AnalysisProfileWithCounts } from '@/lib/analysis/types';

// ── Badge helpers ────────────────────────────────────────────────────

const positionColors: Record<PositionType, { bg: string; text: string }> = {
  congress_member: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  jurist:          { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  executive:       { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  regulator:       { bg: 'bg-green-500/20', text: 'text-green-400' },
  other:           { bg: 'bg-slate-500/20', text: 'text-slate-400' },
};

const positionLabels: Record<PositionType, string> = {
  congress_member: 'Congress',
  jurist: 'Jurist',
  executive: 'Executive',
  regulator: 'Regulator',
  other: 'Other',
};

const statusColors: Record<ResearchStatus, { bg: string; text: string; dot: string }> = {
  pending:     { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  in_progress: { bg: 'bg-blue-500/15',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  complete:    { bg: 'bg-green-500/15',  text: 'text-green-400',  dot: 'bg-green-400' },
  error:       { bg: 'bg-red-500/15',    text: 'text-red-400',    dot: 'bg-red-400' },
};

const statusLabels: Record<ResearchStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  complete: 'Complete',
  error: 'Error',
};

function partyColor(party: string | null): { bg: string; text: string } {
  if (!party) return { bg: '', text: '' };
  const p = party.toUpperCase();
  if (p === 'R' || p === 'REPUBLICAN') return { bg: 'bg-red-500/20', text: 'text-red-400' };
  if (p === 'D' || p === 'DEMOCRAT' || p === 'DEMOCRATIC') return { bg: 'bg-blue-500/20', text: 'text-blue-400' };
  if (p === 'I' || p === 'INDEPENDENT') return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
  return { bg: 'bg-slate-500/20', text: 'text-slate-400' };
}

function partyLabel(party: string | null): string {
  if (!party) return '';
  const p = party.toUpperCase();
  if (p === 'R' || p === 'REPUBLICAN') return 'R';
  if (p === 'D' || p === 'DEMOCRAT' || p === 'DEMOCRATIC') return 'D';
  if (p === 'I' || p === 'INDEPENDENT') return 'I';
  return party;
}

function locationLine(profile: AnalysisProfileWithCounts): string | null {
  switch (profile.position_type) {
    case 'congress_member': {
      const parts: string[] = [];
      if (profile.state) parts.push(profile.state);
      if (profile.district) parts.push(`District ${profile.district}`);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    case 'jurist':
      return profile.court || null;
    default:
      return profile.organization || null;
  }
}

// ── Category icons ──────────────────────────────────────────────────

const categoryIcons: Record<string, { emoji: string; label: string }> = {
  speech:       { emoji: '\uD83C\uDFA4', label: 'Speech' },
  vote:         { emoji: '\uD83D\uDDF3\uFE0F', label: 'Vote' },
  bill:         { emoji: '\uD83D\uDCDC', label: 'Bill' },
  legal_filing: { emoji: '\u2696\uFE0F', label: 'Legal' },
  donation:     { emoji: '\uD83D\uDCB0', label: 'Donation' },
  social_media: { emoji: '\uD83D\uDCF1', label: 'Social' },
  podcast:      { emoji: '\uD83C\uDF99\uFE0F', label: 'Podcast' },
  news:         { emoji: '\uD83D\uDCF0', label: 'News' },
  position:     { emoji: '\uD83D\uDCCC', label: 'Position' },
  uploaded_doc: { emoji: '\uD83D\uDCC4', label: 'Doc' },
};

// ── Research Button (client component) ──────────────────────────────

import StartResearchButton from './StartResearchButton';

// ── Profile Card ─────────────────────────────────────────────────────

function ProfileCard({
  profile,
  orgSlug,
}: {
  profile: AnalysisProfileWithCounts;
  orgSlug: string;
}) {
  const posColor = positionColors[profile.position_type] || positionColors.other;
  const resStatus = statusColors[profile.research_status] || statusColors.pending;
  const location = locationLine(profile);
  const pColor = partyColor(profile.party);

  return (
    <div className="group relative p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all duration-200">
      {/* Unverified anomaly badge */}
      {profile.unverified_count > 0 && (
        <span className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-lg">
          {profile.unverified_count}
        </span>
      )}

      <Link href={`/analysis/${orgSlug}/profiles/${profile.id}/voice`}>
        {/* Name */}
        <h3 className="text-lg font-semibold text-[var(--analysis-text,#fff)] mb-2 group-hover:text-[var(--analysis-primary,#60a5fa)] transition-colors truncate">
          {profile.full_name}
        </h3>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${posColor.bg} ${posColor.text}`}>
            {positionLabels[profile.position_type]}
          </span>
          {profile.party && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${pColor.bg} ${pColor.text}`}>
              {partyLabel(profile.party)}
            </span>
          )}
        </div>

        {/* Location / court / org */}
        {location && (
          <p className="text-xs text-[var(--analysis-text,#fff)] opacity-50 mb-3 truncate">
            {location}
          </p>
        )}
      </Link>

      {/* Footer row: status + data count + research button */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${resStatus.bg} ${resStatus.text}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${resStatus.dot}`} />
          {statusLabels[profile.research_status]}
        </span>

        <div className="flex items-center gap-2">
          {(profile.research_status === 'pending' || profile.research_status === 'error') && (
            <StartResearchButton profileId={profile.id} />
          )}
          <span className="text-[11px] text-[var(--analysis-text,#fff)] opacity-40">
            {profile.data_item_count} item{profile.data_item_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default async function AnalysisDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await verifyAnalysisAccess(orgSlug);
  if (!access) redirect('/analysis/login');

  const { org } = access;
  const profiles = await getOrgProfiles(org.id);

  // Fetch recent data items across all profiles
  const { data: recentItems } = await supabaseAdmin
    .from('analysis_data_items')
    .select('id, category, title, source_name, source_url, item_date, created_at, profile_id')
    .eq('org_id', org.id)
    .eq('verification_status', 'verified')
    .order('created_at', { ascending: false })
    .limit(15);

  // Map profile names for recent items
  const recentProfileIds = [...new Set((recentItems || []).map((i: { profile_id: string }) => i.profile_id))];
  const { data: recentProfiles } = await supabaseAdmin
    .from('analysis_profiles')
    .select('id, full_name')
    .in('id', recentProfileIds.length > 0 ? recentProfileIds : ['__none__']);

  const profileNameMap = new Map((recentProfiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--analysis-text,#fff)]">
            Analysis Dashboard
          </h1>
          <p className="text-sm opacity-40 text-[var(--analysis-text,#fff)] mt-1">
            {profiles.length} profile{profiles.length !== 1 ? 's' : ''} tracked
          </p>
        </div>

        <Link
          href={`/analysis/${orgSlug}/profiles/new`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--analysis-primary, #3b82f6)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Profile
        </Link>
      </div>

      {/* Content */}
      {profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center mb-6">
            <svg className="w-8 h-8 opacity-30 text-[var(--analysis-text,#fff)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--analysis-text,#fff)] mb-2">
            No profiles yet
          </h2>
          <p className="text-sm opacity-40 text-[var(--analysis-text,#fff)] mb-6 max-w-sm">
            Create your first profile to get started
          </p>
          <Link
            href={`/analysis/${orgSlug}/profiles/new`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--analysis-primary, #3b82f6)' }}
          >
            Create Profile
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} orgSlug={orgSlug} />
          ))}
        </div>
      )}

      {/* Recent Updates */}
      {recentItems && recentItems.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-[var(--analysis-text,#fff)] mb-4">
            Recent Updates
          </h2>
          <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
            {recentItems.map((item: { id: string; category: string; title: string; source_name: string | null; source_url: string | null; item_date: string | null; created_at: string; profile_id: string }) => {
              const cat = categoryIcons[item.category] || { emoji: '\uD83D\uDD39', label: item.category };
              const profileName = profileNameMap.get(item.profile_id) || 'Unknown';
              const displayDate = item.item_date
                ? new Date(item.item_date).toLocaleDateString()
                : new Date(item.created_at).toLocaleDateString();

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Category icon */}
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm">
                    {cat.emoji}
                  </span>

                  {/* Title & profile */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--analysis-text, #fff)' }}>
                      {item.title}
                    </p>
                    <p className="text-xs opacity-40 truncate" style={{ color: 'var(--analysis-text, #fff)' }}>
                      {profileName}
                    </p>
                  </div>

                  {/* Source link */}
                  {item.source_name && (
                    <div className="hidden sm:block flex-shrink-0">
                      {item.source_url ? (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs hover:underline truncate max-w-[140px] block"
                          style={{ color: 'var(--analysis-primary, #60a5fa)' }}
                        >
                          {item.source_name}
                        </a>
                      ) : (
                        <span className="text-xs opacity-40 truncate max-w-[140px] block" style={{ color: 'var(--analysis-text, #fff)' }}>
                          {item.source_name}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Date */}
                  <span className="flex-shrink-0 text-xs opacity-40" style={{ color: 'var(--analysis-text, #fff)' }}>
                    {displayDate}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
