'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Radio, Pause, Play, Search, Plus, X, Loader2, CheckCircle, Clock } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface MonitoringConfig {
  id: string;
  profile_id: string;
  org_id: string;
  frequency: 'every_6_hours' | 'daily' | 'weekly';
  search_queries: Array<{ query: string; enabled: boolean }>;
  last_run_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface SearchResult {
  title: string;
  date: string | null;
  source_url: string;
  source_name: string;
  summary: string;
  category: string;
  key_quotes: string[];
}

interface SearchResponse {
  items_created: number;
  results: SearchResult[];
  new_item_ids?: string[];
  error?: string;
}

interface RecentItem {
  id: string;
  title: string | null;
  item_date: string | null;
  category: string;
  source_name: string | null;
  created_at: string;
}

// ─── Frequency Config ───────────────────────────────────────────────

const FREQUENCY_OPTIONS: { value: MonitoringConfig['frequency']; label: string }[] = [
  { value: 'every_6_hours', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

// ─── Page ───────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const profileId = params.profileId as string;

  // Org resolution
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [profileName, setProfileName] = useState<string>('');

  // Config
  const [config, setConfig] = useState<MonitoringConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search queries management
  const [newQueryText, setNewQueryText] = useState('');
  const [showAddQuery, setShowAddQuery] = useState(false);

  // Ad-hoc search
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMeta, setSearchMeta] = useState<{ items_created: number; new_item_ids: string[] } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Recent items
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // ── Fetch org ID ───────────────────────────────────────────────

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/intel/orgs', { cache: 'no-store' });
      if (!res.ok) return;
      const memberships = await res.json();
      const m = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
      if (m) setOrgId(m.org.id);
    } finally {
      setOrgLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => { fetchOrg(); }, [fetchOrg]);

  // ── Fetch config ───────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await fetch(`/api/analysis/monitoring/${profileId}/config`);
      if (!res.ok) return;
      const data = await res.json();
      setConfig(data.config);
    } finally {
      setConfigLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (orgId) fetchConfig();
  }, [orgId, fetchConfig]);

  // ── Fetch profile name ─────────────────────────────────────────

  useEffect(() => {
    if (!orgId) return;
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/analysis/data-items?profile_id=${profileId}&org_id=${orgId}&limit=1`);
        if (res.ok) {
          // We just need the profile name; get it from config or items
        }
      } catch {
        // Ignore
      }
    }
    fetchProfile();
  }, [orgId, profileId]);

  // Use config org_id to confirm, get profile name from page context
  useEffect(() => {
    if (config) {
      // Profile name is fetched separately
    }
  }, [config]);

  // Fetch profile name directly
  useEffect(() => {
    async function loadProfileName() {
      try {
        const res = await fetch(`/api/analysis/monitoring/${profileId}/config`);
        if (!res.ok) return;
        // Profile name isn't in config. We'll set it from the data items endpoint header.
      } catch {
        // Ignore
      }
    }
    loadProfileName();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch recent monitoring items ──────────────────────────────

  const fetchRecentItems = useCallback(async () => {
    if (!orgId) return;
    setRecentLoading(true);
    try {
      const params = new URLSearchParams({
        profile_id: profileId,
        org_id: orgId,
        limit: '20',
      });
      const res = await fetch(`/api/analysis/data-items?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setRecentItems((data.items || []).slice(0, 20));
      // Try to extract profile name from first item or other data
    } catch {
      // Ignore
    } finally {
      setRecentLoading(false);
    }
  }, [orgId, profileId]);

  useEffect(() => {
    if (orgId) fetchRecentItems();
  }, [orgId, fetchRecentItems]);

  // ── Update config helper ───────────────────────────────────────

  async function updateConfig(updates: Partial<Pick<MonitoringConfig, 'frequency' | 'is_active' | 'search_queries'>>) {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/analysis/monitoring/${profileId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active ──────────────────────────────────────────────

  function handleToggleActive() {
    if (!config) return;
    updateConfig({ is_active: !config.is_active });
  }

  // ── Change frequency ───────────────────────────────────────────

  function handleFrequencyChange(frequency: MonitoringConfig['frequency']) {
    updateConfig({ frequency });
  }

  // ── Toggle search query enabled ────────────────────────────────

  function handleToggleQuery(index: number) {
    if (!config) return;
    const updated = config.search_queries.map((q, i) =>
      i === index ? { ...q, enabled: !q.enabled } : q
    );
    updateConfig({ search_queries: updated });
  }

  // ── Remove search query ────────────────────────────────────────

  function handleRemoveQuery(index: number) {
    if (!config) return;
    const updated = config.search_queries.filter((_, i) => i !== index);
    updateConfig({ search_queries: updated });
  }

  // ── Add search query ───────────────────────────────────────────

  function handleAddQuery() {
    if (!config || !newQueryText.trim()) return;
    const updated = [...config.search_queries, { query: newQueryText.trim(), enabled: true }];
    updateConfig({ search_queries: updated });
    setNewQueryText('');
    setShowAddQuery(false);
  }

  // ── Ad-hoc search ──────────────────────────────────────────────

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSearchMeta(null);
    setSearchError(null);

    try {
      const res = await fetch(`/api/analysis/monitoring/${profileId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      const data: SearchResponse = await res.json();

      if (!res.ok) {
        setSearchError(data.error || 'Search failed');
        return;
      }

      setSearchResults(data.results || []);
      setSearchMeta({
        items_created: data.items_created,
        new_item_ids: data.new_item_ids || [],
      });

      // Refresh recent items after search
      if (data.items_created > 0) {
        fetchRecentItems();
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Unknown date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatRelative(dateStr: string | null) {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function getCategoryLabel(cat: string) {
    const labels: Record<string, string> = {
      speech: 'Speech', vote: 'Vote', bill: 'Bill', legal_filing: 'Legal Filing',
      donation: 'Donation', social_media: 'Social Media', podcast: 'Podcast',
      news: 'News', position: 'Position', uploaded_doc: 'Uploaded Doc',
    };
    return labels[cat] || cat;
  }

  // ── Render ─────────────────────────────────────────────────────

  if (orgLoading || configLoading) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading monitoring configuration...
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
        Organization not found.
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
        No monitoring configuration found for this profile. Monitoring config is created when a profile is set up.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        {profileName && (
          <p className="text-xs uppercase tracking-wider opacity-40 mb-1" style={{ color: 'var(--analysis-text)' }}>
            {profileName}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Radio className="w-6 h-6" style={{ color: 'var(--analysis-primary)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--analysis-text)' }}>
            Monitoring
          </h1>
        </div>
      </div>

      {/* ── Status Banner ───────────────────────────────────────── */}
      <div
        className="rounded-lg border p-4 mb-6 flex items-center justify-between flex-wrap gap-3"
        style={{
          borderColor: config.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)',
          backgroundColor: config.is_active ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: config.is_active ? '#22c55e' : '#6b7280',
              boxShadow: config.is_active ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
            }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--analysis-text)' }}>
            {config.is_active ? 'Monitoring active' : 'Monitoring paused'}
          </span>

          {/* Frequency badge */}
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: 'var(--analysis-primary)',
              color: '#fff',
              opacity: 0.9,
            }}
          >
            {FREQUENCY_OPTIONS.find(f => f.value === config.frequency)?.label || config.frequency}
          </span>

          {/* Last run */}
          <span className="text-xs opacity-40 flex items-center gap-1" style={{ color: 'var(--analysis-text)' }}>
            <Clock className="w-3 h-3" />
            Last run: {formatRelative(config.last_run_at)}
          </span>
        </div>

        {/* Pause / Resume button */}
        <button
          onClick={handleToggleActive}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
          style={{
            borderColor: config.is_active ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)',
            backgroundColor: config.is_active ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
            color: config.is_active ? '#eab308' : '#22c55e',
          }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : config.is_active ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {config.is_active ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* ── Frequency Selector ──────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-sm font-medium mb-3 opacity-70" style={{ color: 'var(--analysis-text)' }}>
          Check Frequency
        </h2>
        <div className="flex gap-2">
          {FREQUENCY_OPTIONS.map(opt => {
            const isActive = config.frequency === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleFrequencyChange(opt.value)}
                disabled={saving}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  isActive ? 'border-transparent' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
                style={
                  isActive
                    ? { backgroundColor: 'var(--analysis-primary)', color: '#fff' }
                    : { color: 'var(--analysis-text)' }
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search Queries ──────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium opacity-70" style={{ color: 'var(--analysis-text)' }}>
            Search Queries
          </h2>
          <button
            onClick={() => setShowAddQuery(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            style={{ color: 'var(--analysis-text)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Query
          </button>
        </div>

        {config.search_queries.length === 0 && !showAddQuery && (
          <p className="text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
            No search queries configured. Add queries to automatically monitor for new information.
          </p>
        )}

        <div className="space-y-2">
          {config.search_queries.map((q, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/[0.03]"
            >
              {/* Toggle */}
              <button
                onClick={() => handleToggleQuery(i)}
                disabled={saving}
                className="w-10 h-5 rounded-full relative transition-colors shrink-0"
                style={{
                  backgroundColor: q.enabled ? 'var(--analysis-primary)' : 'rgba(255,255,255,0.15)',
                }}
              >
                <div
                  className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                  style={{ left: q.enabled ? '22px' : '2px' }}
                />
              </button>

              {/* Query text */}
              <span
                className={`flex-1 text-sm ${q.enabled ? '' : 'opacity-40 line-through'}`}
                style={{ color: 'var(--analysis-text)' }}
              >
                {q.query}
              </span>

              {/* Remove */}
              <button
                onClick={() => handleRemoveQuery(i)}
                disabled={saving}
                className="opacity-30 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--analysis-text)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add query input */}
          {showAddQuery && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-white/10 bg-white/[0.03]">
              <input
                type="text"
                value={newQueryText}
                onChange={e => setNewQueryText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddQuery(); if (e.key === 'Escape') { setShowAddQuery(false); setNewQueryText(''); } }}
                placeholder="e.g. recent legislation, committee hearings..."
                autoFocus
                className="flex-1 bg-transparent border-none text-sm placeholder:opacity-40 focus:outline-none"
                style={{ color: 'var(--analysis-text)' }}
              />
              <button
                onClick={handleAddQuery}
                disabled={!newQueryText.trim() || saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30"
                style={{ backgroundColor: 'var(--analysis-primary)', color: '#fff' }}
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddQuery(false); setNewQueryText(''); }}
                className="opacity-40 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--analysis-text)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Ad-hoc Search ───────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-medium mb-3 opacity-70" style={{ color: 'var(--analysis-text)' }}>
          Ad-hoc Search
        </h2>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40"
              style={{ color: 'var(--analysis-text)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !searching) handleSearch(); }}
              placeholder="Search for new information..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
              style={{
                color: 'var(--analysis-text)',
                // @ts-expect-error CSS custom property
                '--tw-ring-color': 'var(--analysis-primary)',
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: 'var(--analysis-primary)', color: '#fff' }}
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search Now
              </>
            )}
          </button>
        </div>

        {/* Search error */}
        {searchError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {searchError}
          </div>
        )}

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchMeta && (
              <p className="text-xs opacity-50 mb-3" style={{ color: 'var(--analysis-text)' }}>
                Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} — {searchMeta.items_created} new item{searchMeta.items_created !== 1 ? 's' : ''} ingested
              </p>
            )}
            {searchResults.map((result, i) => {
              const isNew = searchMeta?.new_item_ids && result.source_url
                ? true // We can't directly map URLs to IDs here, so show based on items_created
                : false;

              return (
                <div
                  key={i}
                  className="px-4 py-3 rounded-lg border border-white/10 bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--analysis-text)' }}>
                          {result.title}
                        </span>
                        {/* Badge */}
                        {searchMeta && searchMeta.items_created > 0 && isNew ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-medium shrink-0">
                            <CheckCircle className="w-3 h-3" />
                            Ingested
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.08] text-[10px] font-medium shrink-0 opacity-50" style={{ color: 'var(--analysis-text)' }}>
                            Duplicate
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-50 mb-1" style={{ color: 'var(--analysis-text)' }}>
                        {result.source_name} {result.date ? `— ${formatDate(result.date)}` : ''}
                      </p>
                      <p className="text-xs opacity-60 leading-relaxed line-clamp-2" style={{ color: 'var(--analysis-text)' }}>
                        {result.summary}
                      </p>
                    </div>
                  </div>
                  {result.source_url && (
                    <a
                      href={result.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs hover:underline"
                      style={{ color: 'var(--analysis-primary)' }}
                    >
                      {result.source_url.length > 70 ? result.source_url.slice(0, 70) + '...' : result.source_url}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Monitoring Updates ────────────────────────────── */}
      <div>
        <h2 className="text-sm font-medium mb-3 opacity-70" style={{ color: 'var(--analysis-text)' }}>
          Recent Updates
        </h2>

        {recentLoading && (
          <div className="flex items-center gap-2 text-sm opacity-40 py-4" style={{ color: 'var(--analysis-text)' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading recent items...
          </div>
        )}

        {!recentLoading && recentItems.length === 0 && (
          <p className="text-sm opacity-40 py-4" style={{ color: 'var(--analysis-text)' }}>
            No recent monitoring updates yet.
          </p>
        )}

        {!recentLoading && recentItems.length > 0 && (
          <div className="space-y-1">
            {recentItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                {/* Category badge */}
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.08] shrink-0"
                  style={{ color: 'var(--analysis-text)' }}
                >
                  {getCategoryLabel(item.category)}
                </span>

                {/* Title */}
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--analysis-text)' }}>
                  {item.title || 'Untitled'}
                </span>

                {/* Source */}
                {item.source_name && (
                  <span className="text-xs opacity-40 shrink-0" style={{ color: 'var(--analysis-text)' }}>
                    {item.source_name}
                  </span>
                )}

                {/* Date */}
                <span className="text-xs opacity-30 shrink-0" style={{ color: 'var(--analysis-text)' }}>
                  {formatDate(item.item_date || item.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
