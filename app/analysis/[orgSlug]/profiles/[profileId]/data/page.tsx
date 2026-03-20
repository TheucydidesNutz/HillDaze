'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Mic,
  Vote,
  ScrollText,
  Gavel,
  DollarSign,
  Globe,
  Headphones,
  Newspaper,
  Target,
  Paperclip,
  Filter,
  Telescope,
} from 'lucide-react';
import DeepResearchModal from '@/components/analysis/DeepResearchModal';

// ─── Types ──────────────────────────────────────────────────────────

interface DataItem {
  id: string;
  profile_id: string;
  org_id: string;
  category: string;
  subcategory: string | null;
  title: string;
  summary: string | null;
  key_quotes: string[] | null;
  key_topics: string[] | null;
  source_url: string | null;
  source_name: string | null;
  source_trust_level: 'trusted' | 'default' | 'ignored';
  item_date: string | null;
  venue: string | null;
  context: string | null;
  tone_analysis: Record<string, unknown> | null;
  folder_path: string | null;
  storage_tier: string | null;
  original_filename: string | null;
  file_size_bytes: number | null;
  verification_status: 'verified' | 'unverified' | 'rejected';
  anomaly_flags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  items: DataItem[];
  total: number;
  category_counts: Record<string, number>;
}

// ─── Category config ────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: typeof Mic; label: string }> = {
  speech:       { icon: Mic,        label: 'Speech' },
  vote:         { icon: Vote,       label: 'Vote' },
  bill:         { icon: ScrollText, label: 'Bill' },
  legal_filing: { icon: Gavel,      label: 'Legal Filing' },
  donation:     { icon: DollarSign, label: 'Donation' },
  social_media: { icon: Globe,      label: 'Social Media' },
  podcast:      { icon: Headphones, label: 'Podcast' },
  news:         { icon: Newspaper,  label: 'News' },
  position:     { icon: Target,     label: 'Position' },
  uploaded_doc: { icon: Paperclip,  label: 'Uploaded Doc' },
};

function getCategoryIcon(category: string) {
  return CATEGORY_CONFIG[category]?.icon ?? ScrollText;
}

function getCategoryLabel(category: string) {
  return CATEGORY_CONFIG[category]?.label ?? category;
}

// ─── Page ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function DataLakeBrowserPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const profileId = params.profileId as string;

  // Org resolution
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  // Data
  const [items, setItems] = useState<DataItem[]>([]);
  const [total, setTotal] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [trustFilter, setTrustFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');

  // UI
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);

  // Verification inline actions
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  // Deep research modal
  const [showDeepResearch, setShowDeepResearch] = useState(false);

  // Additional research
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchResult, setResearchResult] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // ── Debounced search ───────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // ── Fetch data items ──────────────────────────────────────────

  const fetchItems = useCallback(async (append: boolean = false) => {
    if (!orgId) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setOffset(0);
    }
    setError(null);

    const currentOffset = append ? offset : 0;

    const params = new URLSearchParams({
      profile_id: profileId,
      org_id: orgId,
      limit: String(PAGE_SIZE),
      offset: String(currentOffset),
    });

    if (activeCategory) params.set('category', activeCategory);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (trustFilter !== 'all') params.set('source_trust_level', trustFilter);
    if (verificationFilter !== 'all') params.set('verification_status', verificationFilter);

    try {
      const res = await fetch(`/api/analysis/data-items?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch data items');
      }

      const data: ApiResponse = await res.json();

      if (append) {
        setItems(prev => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }

      setTotal(data.total);
      setCategoryCounts(data.category_counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [orgId, profileId, activeCategory, debouncedSearch, trustFilter, verificationFilter, offset]);

  // Fetch on filter change (reset)
  useEffect(() => {
    if (orgId) {
      setExpandedIds(new Set());
      fetchItems(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, activeCategory, debouncedSearch, trustFilter, verificationFilter]);

  // ── Load more ──────────────────────────────────────────────────

  function handleLoadMore() {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
  }

  // Trigger fetch when offset changes (for load-more only)
  useEffect(() => {
    if (offset > 0 && orgId) {
      fetchItems(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  // ── Toggle expand ──────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Verify / Reject handler ──────────────────────────────────

  async function handleVerification(itemId: string, newStatus: 'verified' | 'rejected') {
    setUpdatingItems(prev => new Set(prev).add(itemId));
    try {
      const res = await fetch(`/api/analysis/settings/anomalies/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, verification_status: newStatus } : item
        ));
      }
    } catch (err) {
      console.error('Failed to update verification:', err);
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  // ── Additional research handler ─────────────────────────────

  async function handleResearchSearch() {
    if (!researchQuery.trim()) return;
    setResearchLoading(true);
    setResearchResult(null);
    try {
      const res = await fetch(`/api/analysis/monitoring/${profileId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: researchQuery.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.count ?? data.items?.length ?? 0;
        setResearchResult(`Found ${count} new items`);
        // Refresh the data list
        fetchItems(false);
      } else {
        setResearchResult('Search failed');
      }
    } catch (err) {
      console.error('Research search failed:', err);
      setResearchResult('Search failed');
    } finally {
      setResearchLoading(false);
    }
  }

  // ── Computed ───────────────────────────────────────────────────

  const totalItemCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const hasMore = items.length < total;

  // ── Render ─────────────────────────────────────────────────────

  if (orgLoading) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--analysis-text)' }}>
            Data Lake
          </h1>
          <p className="text-sm opacity-50" style={{ color: 'var(--analysis-text)' }}>
            {totalItemCount} items across {Object.keys(categoryCounts).length} categories
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeepResearch(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
              style={{ color: 'var(--analysis-text)' }}
            >
              <Telescope className="w-4 h-4" />
              Deep Research
            </button>
            <button
              onClick={() => { setShowResearchForm(v => !v); setResearchResult(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
              style={{
                backgroundColor: 'var(--analysis-primary)',
                color: '#fff',
              }}
            >
              <Search className="w-4 h-4" />
              Run Additional Research
            </button>
          </div>
          {showResearchForm && (
            <div className="flex flex-col gap-2 p-3 rounded-lg border border-white/10 bg-white/[0.04]" style={{ minWidth: 320 }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={researchQuery}
                  onChange={e => setResearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleResearchSearch(); }}
                  placeholder="e.g. floor speeches, op-eds..."
                  className="flex-1 px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{
                    color: 'var(--analysis-text)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary)',
                  }}
                />
                <button
                  onClick={handleResearchSearch}
                  disabled={researchLoading || !researchQuery.trim()}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  style={{
                    backgroundColor: 'var(--analysis-primary)',
                    color: '#fff',
                  }}
                >
                  {researchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Search
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['floor speeches', 'committee testimony', 'podcast transcripts', 'op-eds'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setResearchQuery(suggestion)}
                    className="px-2 py-0.5 rounded text-[10px] bg-white/[0.08] hover:bg-white/[0.14] transition-colors"
                    style={{ color: 'var(--analysis-text)' }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              {researchResult && (
                <p className="text-xs font-medium" style={{ color: 'var(--analysis-primary)' }}>
                  {researchResult}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Category pills ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveCategory(null)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            activeCategory === null
              ? 'border-transparent'
              : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
          }`}
          style={
            activeCategory === null
              ? {
                  backgroundColor: 'var(--analysis-primary)',
                  color: '#fff',
                }
              : { color: 'var(--analysis-text)' }
          }
        >
          All
          <span className="opacity-60">{totalItemCount}</span>
        </button>

        {Object.entries(categoryCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, count]) => {
            const Icon = getCategoryIcon(cat);
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(active ? null : cat)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  active
                    ? 'border-transparent'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--analysis-primary)',
                        color: '#fff',
                      }
                    : { color: 'var(--analysis-text)' }
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {getCategoryLabel(cat)}
                <span className="opacity-60">{count}</span>
              </button>
            );
          })}
      </div>

      {/* ── Search & filters bar ───────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40"
            style={{ color: 'var(--analysis-text)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search title, summary, topics..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
            style={{
              color: 'var(--analysis-text)',
              // @ts-expect-error CSS custom property
              '--tw-ring-color': 'var(--analysis-primary)',
            }}
          />
        </div>

        {/* Trust level filter */}
        <div className="relative">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40"
            style={{ color: 'var(--analysis-text)' }}
          />
          <select
            value={trustFilter}
            onChange={e => setTrustFilter(e.target.value)}
            className="pl-8 pr-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm focus:outline-none focus:ring-1 focus:border-transparent appearance-none cursor-pointer"
            style={{
              color: 'var(--analysis-text)',
              // @ts-expect-error CSS custom property
              '--tw-ring-color': 'var(--analysis-primary)',
            }}
          >
            <option value="all">All Trust</option>
            <option value="trusted">Trusted</option>
            <option value="default">Default</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>

        {/* Verification filter */}
        <div>
          <select
            value={verificationFilter}
            onChange={e => setVerificationFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm focus:outline-none focus:ring-1 focus:border-transparent appearance-none cursor-pointer"
            style={{
              color: 'var(--analysis-text)',
              // @ts-expect-error CSS custom property
              '--tw-ring-color': 'var(--analysis-primary)',
            }}
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Loading state ──────────────────────────────────────── */}
      {loading && (
        <div
          className="flex items-center justify-center gap-2 py-16 text-sm opacity-40"
          style={{ color: 'var(--analysis-text)' }}
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading data items...
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────── */}
      {!loading && items.length === 0 && !error && (
        <div
          className="text-center py-16 text-sm opacity-40"
          style={{ color: 'var(--analysis-text)' }}
        >
          No data items found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.
        </div>
      )}

      {/* ── Items list ─────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => {
            const expanded = expandedIds.has(item.id);
            const Icon = getCategoryIcon(item.category);
            const isUnverified = item.verification_status === 'unverified';
            const isRejected = item.verification_status === 'rejected';
            const isUpdating = updatingItems.has(item.id);

            return (
              <div
                key={item.id}
                className={`rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden transition-colors hover:bg-white/[0.05] ${isRejected ? 'opacity-50' : ''}`}
                style={
                  isRejected
                    ? { borderLeftWidth: '3px', borderLeftColor: '#ef4444' }
                    : isUnverified
                      ? { borderLeftWidth: '3px', borderLeftColor: '#eab308' }
                      : undefined
                }
              >
                {/* Row header - clickable */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                  style={{ color: 'var(--analysis-text)' }}
                >
                  {/* Expand chevron */}
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 shrink-0 opacity-40" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0 opacity-40" />
                  )}

                  {/* Category icon */}
                  <Icon className="w-4 h-4 shrink-0 opacity-60" />

                  {/* Title */}
                  <span className={`flex-1 text-sm font-medium truncate ${isRejected ? 'line-through' : ''}`}>
                    {item.title}
                  </span>

                  {/* Date */}
                  {item.item_date && (
                    <span className="text-xs opacity-40 shrink-0">
                      {new Date(item.item_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}

                  {/* Source name with trust color */}
                  {item.source_name && (
                    <span
                      className={`text-xs shrink-0 ${
                        item.source_trust_level === 'trusted'
                          ? 'text-green-400'
                          : item.source_trust_level === 'ignored'
                            ? 'text-red-400 line-through'
                            : 'opacity-70'
                      }`}
                    >
                      {item.source_name}
                    </span>
                  )}

                  {/* Topic tags */}
                  {item.key_topics && item.key_topics.length > 0 && (
                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                      {item.key_topics.slice(0, 3).map(topic => (
                        <span
                          key={topic}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.08] opacity-60"
                        >
                          {topic}
                        </span>
                      ))}
                      {item.key_topics.length > 3 && (
                        <span className="text-[10px] opacity-40">
                          +{item.key_topics.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Verification badge + actions */}
                  {isRejected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-medium shrink-0">
                      <AlertCircle className="w-3 h-3" />
                      Rejected
                    </span>
                  )}
                  {isUnverified && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Unverified
                      </span>
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin opacity-60" />
                      ) : (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); handleVerification(item.id, 'verified'); }}
                            className="w-5 h-5 rounded flex items-center justify-center bg-green-500/15 text-green-400 hover:bg-green-500/30 transition-colors text-xs"
                            title="Verify"
                          >
                            ✓
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleVerification(item.id, 'rejected'); }}
                            className="w-5 h-5 rounded flex items-center justify-center bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-colors text-xs"
                            title="Reject"
                          >
                            ✗
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </button>

                {/* Expanded content */}
                {expanded && (
                  <div
                    className="px-4 pb-4 pt-0 ml-11 border-t border-white/5 space-y-4"
                    style={{ color: 'var(--analysis-text)' }}
                  >
                    {/* Summary */}
                    {item.summary && (
                      <div className="pt-3">
                        <p className="text-sm opacity-70 leading-relaxed">{item.summary}</p>
                      </div>
                    )}

                    {/* Key quotes */}
                    {item.key_quotes && item.key_quotes.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-medium uppercase tracking-wide opacity-40">
                          Key Quotes
                        </span>
                        {item.key_quotes.map((quote, i) => (
                          <blockquote
                            key={i}
                            className="pl-4 py-2 text-sm italic opacity-80 leading-relaxed"
                            style={{
                              borderLeft: '3px solid var(--analysis-primary)',
                            }}
                          >
                            &ldquo;{quote}&rdquo;
                          </blockquote>
                        ))}
                      </div>
                    )}

                    {/* All topic tags (shown on mobile too when expanded) */}
                    {item.key_topics && item.key_topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:hidden">
                        {item.key_topics.map(topic => (
                          <span
                            key={topic}
                            className="px-2 py-0.5 rounded text-xs bg-white/[0.08] opacity-60"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Source URL */}
                    {item.source_url && (
                      <div>
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs hover:underline"
                          style={{ color: 'var(--analysis-primary)' }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {item.source_url.length > 80
                            ? item.source_url.slice(0, 80) + '...'
                            : item.source_url}
                        </a>
                      </div>
                    )}

                    {/* Data item ID */}
                    <div>
                      <span className="font-mono text-[10px] opacity-30 select-all">
                        {item.id}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Load more ──────────────────────────────────────────── */}
      {!loading && hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 rounded-lg text-sm font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            style={{ color: 'var(--analysis-text)' }}
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More
                <span className="text-xs opacity-40">
                  ({items.length} of {total})
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── End of list ────────────────────────────────────────── */}
      {!loading && !hasMore && items.length > 0 && (
        <div
          className="mt-6 text-center text-xs opacity-30"
          style={{ color: 'var(--analysis-text)' }}
        >
          Showing all {total} items
        </div>
      )}

      {/* ── Deep Research Modal ─────────────────────────────────── */}
      {showDeepResearch && (
        <DeepResearchModal
          profileId={profileId}
          profileName="Profile"
          onClose={() => setShowDeepResearch(false)}
          onComplete={() => fetchItems(false)}
        />
      )}
    </div>
  );
}
