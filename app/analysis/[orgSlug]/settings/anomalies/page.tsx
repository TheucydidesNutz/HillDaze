'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  X,
  ExternalLink,
  Loader2,
  Undo2,
  ChevronDown,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface AnomalyFlag {
  type: string;
  reason: string;
}

interface DataItem {
  id: string;
  profile_id: string;
  org_id: string;
  category: string;
  subcategory: string | null;
  title: string | null;
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  source_trust_level: 'trusted' | 'default' | 'ignored';
  item_date: string | null;
  verification_status: 'verified' | 'unverified' | 'rejected';
  anomaly_flags: { flags?: AnomalyFlag[] } | null;
  created_at: string;
  updated_at: string;
}

interface ProfileInfo {
  id: string;
  full_name: string;
}

type FilterTab = 'pending' | 'all' | 'verified' | 'rejected';
type SortMode = 'date_flagged' | 'anomaly_type' | 'profile';

interface UndoEntry {
  itemId: string;
  previousStatus: 'verified' | 'unverified' | 'rejected';
  newStatus: 'verified' | 'rejected';
  timer: NodeJS.Timeout;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getVerificationParam(tab: FilterTab): string | undefined {
  switch (tab) {
    case 'pending':
      return 'unverified';
    case 'verified':
      return 'verified';
    case 'rejected':
      return 'rejected';
    default:
      return undefined;
  }
}

// ─── Page ───────────────────────────────────────────────────────────

export default function AnomalyReviewPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  // Org resolution
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  // Profile map
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);

  // Data
  const [items, setItems] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counts for badge
  const [pendingCount, setPendingCount] = useState(0);

  // Filters
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [sortMode, setSortMode] = useState<SortMode>('date_flagged');

  // Undo stack
  const [undoEntries, setUndoEntries] = useState<UndoEntry[]>([]);
  const undoRef = useRef<UndoEntry[]>([]);
  undoRef.current = undoEntries;

  // ── Fetch org ID ───────────────────────────────────────────────

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/intel/orgs', { cache: 'no-store' });
      if (!res.ok) return;
      const memberships = await res.json();
      const m = memberships.find(
        (m: { org: { slug: string; id: string } }) => m.org.slug === orgSlug
      );
      if (m) setOrgId(m.org.id);
    } finally {
      setOrgLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  // ── Fetch profiles for this org ────────────────────────────────

  const fetchProfiles = useCallback(async () => {
    if (!orgId) return;
    try {
      // Use the dashboard API pattern — fetch org profiles via data-items per profile
      // Actually we need a profiles list. Let's use the supabase admin route or dashboard.
      // The dashboard page uses getOrgProfiles server-side. For client, we'll fetch
      // via the orgs endpoint which returns memberships, but we need profiles.
      // Simplest: fetch via a dedicated call. Since there's no profiles API,
      // we'll fetch from the dashboard page data by scraping profile info from data items.
      // Better approach: call each profile's data-items endpoint.
      // Actually, let's just fetch the org membership which gives us the org_id,
      // then we can query profiles. But there's no client-accessible profiles endpoint.
      // So let's use the approach: fetch data items for ALL profiles by first getting
      // profile list from the org dashboard's getOrgProfiles.
      // Since this is a client component, we need an API. Let's check if there's one...
      // There isn't a dedicated profiles API, so we'll fetch from the intel orgs endpoint
      // which returns org data, and then query analysis_profiles via data-items.
      //
      // Workaround: We'll fetch profiles from the data items themselves.
      // The data items include profile_id, so after fetching items we map profile IDs.
      // But we need profile names. Let's fetch the org details which might have profiles.
      //
      // Actually the simplest real approach: fetch the org endpoint to get org_id,
      // then query data-items per profile. But we don't know the profiles yet.
      //
      // Let's use the /api/intel/orgs/[org-id] endpoint to get org info,
      // then try to find profiles through the analysis dashboard or similar.
      //
      // Since we can't easily get profiles on the client side without an API,
      // we'll fetch ALL data items by querying without profile_id filter.
      // But the data-items API requires profile_id...
      //
      // The actual working approach: We fetch the org members list to get org context,
      // then we'll directly call the data-items API for each profile.
      // But we need the profile list first.
      //
      // For now, the best working approach is to fetch profiles via a direct query.
      // Since we don't have a profiles API endpoint, let's create a simple fetch
      // that gets profile data from the org endpoint or similar.
      //
      // Using the /api/intel/orgs/[org-id] endpoint:
      const orgRes = await fetch(`/api/intel/orgs/${orgId}`);
      if (!orgRes.ok) return;
      const orgData = await orgRes.json();

      // Check if it returns profiles
      if (orgData.profiles && Array.isArray(orgData.profiles)) {
        const pMap: Record<string, string> = {};
        const pList: ProfileInfo[] = [];
        for (const p of orgData.profiles) {
          pMap[p.id] = p.full_name;
          pList.push({ id: p.id, full_name: p.full_name });
        }
        setProfileMap(pMap);
        setProfiles(pList);
      }
    } catch {
      // Profile fetch failed — we'll still display items without names
    }
  }, [orgId]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ── Fetch items across all profiles ────────────────────────────

  const fetchItems = useCallback(async () => {
    if (!orgId || profiles.length === 0) return;

    setLoading(true);
    setError(null);

    const verificationStatus = getVerificationParam(activeTab);

    try {
      // Fetch data items for each profile in parallel
      const fetchPromises = profiles.map(async (profile) => {
        const queryParams = new URLSearchParams({
          profile_id: profile.id,
          org_id: orgId,
          limit: '200',
          offset: '0',
        });

        if (verificationStatus) {
          queryParams.set('verification_status', verificationStatus);
        }

        const res = await fetch(
          `/api/analysis/data-items?${queryParams.toString()}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.items || []) as DataItem[];
      });

      const results = await Promise.all(fetchPromises);
      const allItems = results.flat();

      // Filter: for 'all' tab, show everything; for specific tabs, already filtered by API
      // Only keep items that have anomaly_flags with at least one flag
      const flaggedItems = allItems.filter((item) => {
        const flags = item.anomaly_flags;
        if (!flags) return false;
        if (typeof flags === 'object' && 'flags' in flags) {
          return Array.isArray(flags.flags) && flags.flags.length > 0;
        }
        return false;
      });

      setItems(flaggedItems);

      // Also compute pending count (always, for the badge)
      if (activeTab === 'pending') {
        setPendingCount(flaggedItems.length);
      } else {
        // Fetch pending count separately
        const pendingPromises = profiles.map(async (profile) => {
          const qp = new URLSearchParams({
            profile_id: profile.id,
            org_id: orgId,
            limit: '1',
            offset: '0',
            verification_status: 'unverified',
          });
          const res = await fetch(`/api/analysis/data-items?${qp.toString()}`);
          if (!res.ok) return 0;
          const data = await res.json();
          return data.total || 0;
        });
        const counts = await Promise.all(pendingPromises);
        setPendingCount(counts.reduce((a, b) => a + b, 0));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  }, [orgId, profiles, activeTab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Build profile map from fetched items (fallback if profile fetch didn't return names)
  useEffect(() => {
    if (Object.keys(profileMap).length === 0 && items.length > 0) {
      // We don't have names — show profile IDs as fallback
      const map: Record<string, string> = {};
      for (const item of items) {
        if (!map[item.profile_id]) {
          map[item.profile_id] = `Profile ${item.profile_id.slice(0, 8)}...`;
        }
      }
      setProfileMap((prev) =>
        Object.keys(prev).length > 0 ? prev : map
      );
    }
  }, [items, profileMap]);

  // ── Sort items ────────────────────────────────────────────────

  const sortedItems = [...items].sort((a, b) => {
    switch (sortMode) {
      case 'date_flagged':
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case 'anomaly_type': {
        const aType =
          a.anomaly_flags &&
          'flags' in a.anomaly_flags &&
          Array.isArray(a.anomaly_flags.flags) &&
          a.anomaly_flags.flags[0]?.type
            ? a.anomaly_flags.flags[0].type
            : '';
        const bType =
          b.anomaly_flags &&
          'flags' in b.anomaly_flags &&
          Array.isArray(b.anomaly_flags.flags) &&
          b.anomaly_flags.flags[0]?.type
            ? b.anomaly_flags.flags[0].type
            : '';
        return aType.localeCompare(bType);
      }
      case 'profile': {
        const aName = profileMap[a.profile_id] || '';
        const bName = profileMap[b.profile_id] || '';
        return aName.localeCompare(bName);
      }
      default:
        return 0;
    }
  });

  // ── Action handlers ───────────────────────────────────────────

  const handleAction = useCallback(
    async (itemId: string, newStatus: 'verified' | 'rejected') => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const previousStatus = item.verification_status;

      // Optimistically update the item in state
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, verification_status: newStatus } : i
        )
      );

      // Fire API call
      try {
        const res = await fetch(`/api/analysis/settings/anomalies/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verification_status: newStatus }),
        });

        if (!res.ok) {
          // Revert on failure
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? { ...i, verification_status: previousStatus }
                : i
            )
          );
          return;
        }
      } catch {
        // Revert on error
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, verification_status: previousStatus }
              : i
          )
        );
        return;
      }

      // Update pending count
      if (previousStatus === 'unverified') {
        setPendingCount((c) => Math.max(0, c - 1));
      } else if ((newStatus as string) === 'unverified') {
        setPendingCount((c) => c + 1);
      }

      // Set up undo window (10 seconds)
      const timer = setTimeout(() => {
        setUndoEntries((prev) => prev.filter((e) => e.itemId !== itemId));
      }, 10000);

      const entry: UndoEntry = {
        itemId,
        previousStatus,
        newStatus,
        timer,
      };

      setUndoEntries((prev) => [...prev.filter((e) => e.itemId !== itemId), entry]);
    },
    [items]
  );

  const handleUndo = useCallback(
    async (itemId: string) => {
      const entry = undoRef.current.find((e) => e.itemId === itemId);
      if (!entry) return;

      // Clear the timer
      clearTimeout(entry.timer);
      setUndoEntries((prev) => prev.filter((e) => e.itemId !== itemId));

      // Revert status
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, verification_status: entry.previousStatus }
            : i
        )
      );

      // Update pending count
      if (entry.previousStatus === 'unverified') {
        setPendingCount((c) => c + 1);
      } else if ((entry.newStatus as string) === 'unverified') {
        setPendingCount((c) => Math.max(0, c - 1));
      }

      // Fire API call to revert
      try {
        await fetch(`/api/analysis/data-items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verification_status: entry.previousStatus }),
        });
      } catch {
        // Best effort — already updated UI
      }
    },
    []
  );

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      for (const entry of undoRef.current) {
        clearTimeout(entry.timer);
      }
    };
  }, []);

  // ── Filter displayed items based on active tab ─────────────────
  // Items are already filtered by the API query, but after optimistic updates
  // an item's status may have changed locally. Apply client-side filter too.

  const displayItems = sortedItems.filter((item) => {
    const undoEntry = undoEntries.find((e) => e.itemId === item.id);

    switch (activeTab) {
      case 'pending':
        // Show items that are unverified OR items that were just actioned (for undo)
        return (
          item.verification_status === 'unverified' ||
          (undoEntry && undoEntry.previousStatus === 'unverified')
        );
      case 'verified':
        return (
          item.verification_status === 'verified' ||
          (undoEntry && undoEntry.newStatus === 'verified')
        );
      case 'rejected':
        return (
          item.verification_status === 'rejected' ||
          (undoEntry && undoEntry.newStatus === 'rejected')
        );
      default:
        return true;
    }
  });

  // ── Render ─────────────────────────────────────────────────────

  if (orgLoading) {
    return (
      <div
        className="flex items-center gap-2 text-sm opacity-40"
        style={{ color: 'var(--analysis-text)' }}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!orgId) {
    return (
      <div
        className="text-sm opacity-60"
        style={{ color: 'var(--analysis-text)' }}
      >
        Organization not found.
      </div>
    );
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'all', label: 'All' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const SORT_OPTIONS: { key: SortMode; label: string }[] = [
    { key: 'date_flagged', label: 'Date flagged' },
    { key: 'anomaly_type', label: 'Anomaly type' },
    { key: 'profile', label: 'Profile' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle
            className="w-6 h-6"
            style={{ color: 'var(--analysis-primary)' }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-2xl font-bold"
                style={{ color: 'var(--analysis-text)' }}
              >
                Anomaly Review
              </h1>
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                  {pendingCount}
                </span>
              )}
            </div>
            <p
              className="text-sm opacity-50 mt-0.5"
              style={{ color: 'var(--analysis-text)' }}
            >
              Review flagged data items across all profiles
            </p>
          </div>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <ChevronDown
              className="w-3.5 h-3.5 opacity-40"
              style={{ color: 'var(--analysis-text)' }}
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="pl-2 pr-6 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-xs focus:outline-none focus:ring-1 focus:border-transparent appearance-none cursor-pointer"
              style={{
                color: 'var(--analysis-text)',
                // @ts-expect-error CSS custom property
                '--tw-ring-color': 'var(--analysis-primary)',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.04] border border-white/10">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isActive ? '' : 'hover:bg-white/[0.06]'
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: 'var(--analysis-primary)',
                      color: '#fff',
                    }
                  : { color: 'var(--analysis-text)', opacity: 0.6 }
              }
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span
                  className={`ml-1.5 text-xs ${
                    isActive ? 'opacity-80' : 'opacity-50'
                  }`}
                >
                  ({pendingCount})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          className="flex items-center justify-center gap-2 py-16 text-sm opacity-40"
          style={{ color: 'var(--analysis-text)' }}
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading anomalies across all profiles...
        </div>
      )}

      {/* Empty state */}
      {!loading && displayItems.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center mb-5">
            <Check
              className="w-7 h-7 opacity-30"
              style={{ color: 'var(--analysis-text)' }}
            />
          </div>
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: 'var(--analysis-text)' }}
          >
            {activeTab === 'pending'
              ? 'All caught up'
              : `No ${activeTab === 'all' ? 'flagged' : activeTab} items`}
          </h2>
          <p
            className="text-sm opacity-40 max-w-sm"
            style={{ color: 'var(--analysis-text)' }}
          >
            {activeTab === 'pending'
              ? 'No anomalies are waiting for review right now.'
              : 'Items will appear here as they are flagged and reviewed.'}
          </p>
        </div>
      )}

      {/* Items list */}
      {!loading && displayItems.length > 0 && (
        <div className="space-y-3">
          {displayItems.map((item) => {
            const isUnverified = item.verification_status === 'unverified';
            const isActioned = item.verification_status !== 'unverified';
            const undoEntry = undoEntries.find((e) => e.itemId === item.id);
            const flags =
              item.anomaly_flags &&
              'flags' in item.anomaly_flags &&
              Array.isArray(item.anomaly_flags.flags)
                ? (item.anomaly_flags.flags as AnomalyFlag[])
                : [];
            const profileName =
              profileMap[item.profile_id] || 'Unknown Profile';

            return (
              <div
                key={item.id}
                className={`rounded-lg border overflow-hidden transition-all ${
                  undoEntry
                    ? 'bg-white/[0.02] border-white/5 opacity-60'
                    : 'bg-white/[0.03] border-white/10'
                }`}
                style={
                  isUnverified && !undoEntry
                    ? {
                        borderLeftWidth: '3px',
                        borderLeftColor: '#eab308',
                      }
                    : undefined
                }
              >
                <div className="px-5 py-4">
                  {/* Profile name */}
                  <p
                    className="text-xs font-medium uppercase tracking-wide mb-1.5 opacity-50"
                    style={{ color: 'var(--analysis-text)' }}
                  >
                    {profileName}
                  </p>

                  {/* Title */}
                  <h3
                    className="text-base font-semibold mb-2"
                    style={{ color: 'var(--analysis-text)' }}
                  >
                    {item.title || 'Untitled Item'}
                  </h3>

                  {/* Source + date row */}
                  <div className="flex items-center gap-3 mb-3">
                    {item.source_name && (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--analysis-text)', opacity: 0.6 }}
                      >
                        {item.source_url ? (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                            style={{ color: 'var(--analysis-primary)' }}
                          >
                            {item.source_name}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          item.source_name
                        )}
                      </span>
                    )}
                    {item.item_date && (
                      <span
                        className="text-xs opacity-40"
                        style={{ color: 'var(--analysis-text)' }}
                      >
                        {formatDate(item.item_date)}
                      </span>
                    )}
                    {/* Category badge */}
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-[10px] font-medium opacity-50"
                      style={{ color: 'var(--analysis-text)' }}
                    >
                      {item.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Anomaly flags */}
                  {flags.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {flags.map((flag, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 px-3 py-2 rounded-md bg-yellow-500/[0.07] border border-yellow-500/15"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">
                              {flag.type.replace(/_/g, ' ')}
                            </span>
                            <p
                              className="text-xs mt-0.5 opacity-70 leading-relaxed"
                              style={{ color: 'var(--analysis-text)' }}
                            >
                              {flag.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action buttons / Undo bar */}
                  {undoEntry ? (
                    <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                      <span
                        className="text-xs opacity-50"
                        style={{ color: 'var(--analysis-text)' }}
                      >
                        Marked as{' '}
                        <span className="font-medium">
                          {undoEntry.newStatus === 'verified'
                            ? 'relevant'
                            : 'ignored'}
                        </span>
                      </span>
                      <button
                        onClick={() => handleUndo(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-100 opacity-70"
                        style={{ color: 'var(--analysis-primary)' }}
                      >
                        <Undo2 className="w-3 h-3" />
                        Undo
                      </button>
                    </div>
                  ) : (
                    isUnverified && (
                      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                        <button
                          onClick={() => handleAction(item.id, 'verified')}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium text-white transition-colors bg-green-600 hover:bg-green-500"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Relevant
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'rejected')}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium text-white transition-colors bg-red-600/80 hover:bg-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                          Ignore
                        </button>
                      </div>
                    )
                  )}

                  {/* Show status badge for already-actioned items (no undo) */}
                  {isActioned && !undoEntry && (
                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                          item.verification_status === 'verified'
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {item.verification_status === 'verified' ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        {item.verification_status === 'verified'
                          ? 'Verified'
                          : 'Rejected'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* End of list marker */}
      {!loading && displayItems.length > 0 && (
        <div
          className="mt-6 text-center text-xs opacity-30"
          style={{ color: 'var(--analysis-text)' }}
        >
          Showing {displayItems.length} flagged item
          {displayItems.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
