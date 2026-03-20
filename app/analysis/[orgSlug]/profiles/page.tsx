import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import { getOrgProfiles } from '@/lib/analysis/supabase-queries';
import type { PositionType, ResearchStatus } from '@/lib/analysis/types';
import type { AnalysisProfileWithCounts } from '@/lib/analysis/types';
import StartResearchButton from '../dashboard/StartResearchButton';

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

// ── Profile Row ──────────────────────────────────────────────────────

function ProfileRow({
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
    <div className="group relative flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all duration-200">
      {/* Unverified badge */}
      {profile.unverified_count > 0 && (
        <span className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-lg">
          {profile.unverified_count}
        </span>
      )}

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{ backgroundColor: 'var(--analysis-primary, #3b82f6)' }}
      >
        {profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <Link href={`/analysis/${orgSlug}/profiles/${profile.id}/voice`} className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[var(--analysis-text,#fff)] group-hover:text-[var(--analysis-primary,#60a5fa)] transition-colors truncate">
          {profile.full_name}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          {location && (
            <span className="text-xs text-[var(--analysis-text,#fff)] opacity-40 truncate">
              {location}
            </span>
          )}
        </div>
      </Link>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${posColor.bg} ${posColor.text}`}>
          {positionLabels[profile.position_type]}
        </span>
        {profile.party && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${pColor.bg} ${pColor.text}`}>
            {partyLabel(profile.party)}
          </span>
        )}
      </div>

      {/* Status + count */}
      <div className="flex items-center gap-3 shrink-0">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${resStatus.bg} ${resStatus.text}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${resStatus.dot}`} />
          {statusLabels[profile.research_status]}
        </span>
        <span className="text-[11px] text-[var(--analysis-text,#fff)] opacity-40 w-16 text-right">
          {profile.data_item_count} item{profile.data_item_count !== 1 ? 's' : ''}
        </span>
        {(profile.research_status === 'pending' || profile.research_status === 'error') && (
          <StartResearchButton profileId={profile.id} />
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default async function ProfilesListPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await verifyAnalysisAccess(orgSlug);
  if (!access) redirect('/analysis/login');

  const { org } = access;
  const profiles = await getOrgProfiles(org.id);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--analysis-text,#fff)]">
            Profiles
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
            Create your first profile to start building intelligence dossiers
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
        <div className="space-y-2">
          {profiles.map((profile) => (
            <ProfileRow key={profile.id} profile={profile} orgSlug={orgSlug} />
          ))}
        </div>
      )}
    </div>
  );
}
