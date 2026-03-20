'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { UserPlus, Users, ExternalLink, Loader2, X } from 'lucide-react';

interface StafferProfile {
  id: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  research_status: string;
  aliases: string[];
  created_at: string;
}

interface ParentProfile {
  id: string;
  full_name: string;
  organization: string | null;
  org_id: string;
}

export default function StaffersPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const profileId = params.profileId as string;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [staffers, setStaffers] = useState<StafferProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formOrganization, setFormOrganization] = useState('');
  const [formAliases, setFormAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState('');
  const [triggerResearch, setTriggerResearch] = useState(false);

  // Data items for showing key topics on staffer cards
  const [stafferTopics, setStafferTopics] = useState<Record<string, string[]>>({});

  const fetchData = useCallback(async () => {
    try {
      // 1. Get org ID
      const orgsRes = await fetch('/api/intel/orgs', { cache: 'no-store' });
      if (!orgsRes.ok) throw new Error('Failed to fetch organizations');
      const memberships = await orgsRes.json();
      const m = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
      if (!m) throw new Error('Organization not found');
      const resolvedOrgId = m.org.id;
      setOrgId(resolvedOrgId);

      // 2. Fetch parent profile details via voice API
      const voiceRes = await fetch(`/api/analysis/voice/${profileId}`, { cache: 'no-store' });
      if (voiceRes.ok) {
        const voiceData = await voiceRes.json();
        if (voiceData.profile) {
          setParentProfile({
            id: voiceData.profile.id,
            full_name: voiceData.profile.full_name,
            organization: voiceData.profile.organization,
            org_id: resolvedOrgId,
          });
          setFormOrganization(voiceData.profile.organization || '');
        }
      }

      // 3. Fetch staffers
      const staffersRes = await fetch(
        `/api/analysis/profiles/staffers?parent_profile_id=${profileId}&org_id=${resolvedOrgId}`,
        { cache: 'no-store' }
      );
      if (!staffersRes.ok) throw new Error('Failed to fetch staffers');
      const staffersData = await staffersRes.json();
      setStaffers(staffersData.staffers || []);

      // Fetch key topics for each staffer (from data items)
      if (staffersData.staffers && staffersData.staffers.length > 0) {
        const topicsMap: Record<string, string[]> = {};
        await Promise.all(
          staffersData.staffers.map(async (staffer: StafferProfile) => {
            try {
              const itemsRes = await fetch(
                `/api/analysis/data-items?profile_id=${staffer.id}&limit=10`,
                { cache: 'no-store' }
              );
              if (itemsRes.ok) {
                const itemsData = await itemsRes.json();
                const topics = new Set<string>();
                (itemsData.items || []).forEach((item: { key_topics?: string[] }) => {
                  (item.key_topics || []).forEach((t: string) => topics.add(t));
                });
                topicsMap[staffer.id] = Array.from(topics).slice(0, 5);
              }
            } catch {
              // Ignore per-staffer topic fetch errors
            }
          })
        );
        setStafferTopics(topicsMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function resetModal() {
    setFormName('');
    setFormTitle('');
    setFormOrganization(parentProfile?.organization || '');
    setFormAliases([]);
    setAliasInput('');
    setSubmitError(null);
    setTriggerResearch(false);
  }

  function openModal() {
    resetModal();
    setShowModal(true);
  }

  function addAlias() {
    const trimmed = aliasInput.trim();
    if (trimmed && !formAliases.includes(trimmed)) {
      setFormAliases(prev => [...prev, trimmed]);
    }
    setAliasInput('');
  }

  function removeAlias(alias: string) {
    setFormAliases(prev => prev.filter(a => a !== alias));
  }

  function handleAliasKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAlias();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !formName.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/analysis/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          full_name: formName.trim(),
          position_type: 'other',
          profile_type: 'staffer',
          parent_profile_id: profileId,
          title: formTitle.trim() || undefined,
          organization: formOrganization.trim() || undefined,
          aliases: formAliases,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create staffer');
      }

      const { profile } = await res.json();

      // Optionally trigger research
      if (triggerResearch) {
        fetch(`/api/analysis/profiles/${profile.id}/research`, {
          method: 'POST',
        }).catch(() => {
          // Fire-and-forget; research errors are non-blocking
        });
      }

      // Refresh the staffer list
      setShowModal(false);
      setStaffers(prev => [...prev, profile].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function getResearchBadge(status: string) {
    switch (status) {
      case 'complete':
        return { label: 'Researched', bg: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)' };
      case 'in_progress':
        return { label: 'Researching...', bg: 'rgba(234,179,8,0.15)', color: 'rgb(234,179,8)' };
      case 'error':
        return { label: 'Error', bg: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)' };
      default:
        return { label: 'Pending', bg: 'rgba(148,163,184,0.15)', color: 'rgb(148,163,184)' };
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading staffers...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--analysis-text)' }}>
            {parentProfile?.full_name || 'Profile'}
          </p>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--analysis-text)' }}>
            <Users className="w-6 h-6 opacity-60" />
            Staffers
          </h1>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--analysis-primary)' }}
        >
          <UserPlus className="w-4 h-4" />
          Add Staffer
        </button>
      </div>

      {/* Staffer List */}
      {staffers.length === 0 ? (
        <div
          className="rounded-xl border border-white/10 bg-white/[0.03] p-12 text-center"
        >
          <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--analysis-text)' }} />
          <p className="text-sm opacity-50 mb-4" style={{ color: 'var(--analysis-text)' }}>
            No staffers linked to this profile yet.
          </p>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--analysis-primary)' }}
          >
            <UserPlus className="w-4 h-4" />
            Add First Staffer
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {staffers.map(staffer => {
            const badge = getResearchBadge(staffer.research_status);
            const topics = stafferTopics[staffer.id] || [];

            return (
              <button
                key={staffer.id}
                onClick={() => router.push(`/analysis/${orgSlug}/profiles/${staffer.id}/voice`)}
                className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--analysis-text)' }}>
                        {staffer.full_name}
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {staffer.title && (
                      <p className="text-xs opacity-50 mb-1" style={{ color: 'var(--analysis-text)' }}>
                        {staffer.title}
                      </p>
                    )}
                    {topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {topics.map(topic => (
                          <span
                            key={topic}
                            className="inline-block px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px]"
                            style={{ color: 'var(--analysis-text)' }}
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ExternalLink
                    className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity shrink-0 mt-1 ml-3"
                    style={{ color: 'var(--analysis-text)' }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Add Staffer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--analysis-bg, #0f1117)' }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 opacity-40 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--analysis-text)' }}
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--analysis-text)' }}>
              Add Staffer
            </h2>
            <p className="text-xs opacity-40 mb-6" style={{ color: 'var(--analysis-text)' }}>
              Link a staffer profile to {parentProfile?.full_name || 'this profile'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--analysis-text)' }}>
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{
                    color: 'var(--analysis-text)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary)',
                  }}
                  autoFocus
                />
              </div>

              {/* Title / Role */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--analysis-text)' }}>
                  Title / Role
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Chief of Staff, Legislative Director"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{
                    color: 'var(--analysis-text)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary)',
                  }}
                />
              </div>

              {/* Organization (auto-populated) */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--analysis-text)' }}>
                  Organization
                </label>
                <input
                  type="text"
                  value={formOrganization}
                  onChange={e => setFormOrganization(e.target.value)}
                  placeholder="e.g. Office of Senator Smith"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{
                    color: 'var(--analysis-text)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary)',
                  }}
                />
              </div>

              {/* Aliases */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--analysis-text)' }}>
                  Aliases <span className="text-xs opacity-40">(press Enter to add)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aliasInput}
                    onChange={e => setAliasInput(e.target.value)}
                    onKeyDown={handleAliasKeyDown}
                    placeholder="e.g. J. Doe"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                    style={{
                      color: 'var(--analysis-text)',
                      // @ts-expect-error CSS custom property
                      '--tw-ring-color': 'var(--analysis-primary)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={addAlias}
                    className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm hover:bg-white/[0.1] transition-colors"
                    style={{ color: 'var(--analysis-text)' }}
                  >
                    Add
                  </button>
                </div>
                {formAliases.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formAliases.map(alias => (
                      <span
                        key={alias}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/10 text-xs"
                        style={{ color: 'var(--analysis-text)' }}
                      >
                        {alias}
                        <button
                          type="button"
                          onClick={() => removeAlias(alias)}
                          className="opacity-50 hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Trigger Research toggle */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTriggerResearch(!triggerResearch)}
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={{
                    backgroundColor: triggerResearch
                      ? 'var(--analysis-primary)'
                      : 'rgba(255,255,255,0.12)',
                  }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{
                      transform: triggerResearch ? 'translateX(16px)' : 'translateX(0)',
                    }}
                  />
                </button>
                <span className="text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
                  Run research after creation
                </span>
              </div>

              {/* Error */}
              {submitError && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {submitError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-colors"
                  style={{ color: 'var(--analysis-text)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formName.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{ backgroundColor: 'var(--analysis-primary)' }}
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? 'Creating...' : 'Create Staffer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
