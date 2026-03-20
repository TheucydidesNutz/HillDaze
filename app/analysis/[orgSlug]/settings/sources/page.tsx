'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ExternalLink, Search, Shield, ShieldCheck, ShieldX, Loader2, X, Key } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TrustLevel = 'trusted' | 'default' | 'ignored';
type SourceCategory = 'government' | 'news' | 'legal' | 'social' | 'custom';

interface Source {
  id: string;
  org_id: string;
  source_name: string;
  source_url: string | null;
  category: SourceCategory | null;
  trust_level: TrustLevel;
  is_default: boolean;
  created_at: string;
}

interface ApiKeyStatus {
  service_name: string;
  is_active: boolean;
}

// Map source URLs/names to the service_name in org_api_keys
const SOURCE_TO_SERVICE: Record<string, string> = {
  'congress.gov': 'congress_gov',
  'api.congress.gov': 'congress_gov',
  'opensecrets.org': 'opensecrets',
  'courtlistener.com': 'courtlistener',
  'pacer.uscourts.gov': 'pacer',
  'listennotes.com': 'listen_notes',
};

function getServiceForSource(source: Source): string | null {
  if (!source.source_url) return null;
  const url = source.source_url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  for (const [domain, service] of Object.entries(SOURCE_TO_SERVICE)) {
    if (url.includes(domain)) return service;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORIES: { value: SourceCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'government', label: 'Government' },
  { value: 'news', label: 'News' },
  { value: 'legal', label: 'Legal' },
  { value: 'social', label: 'Social' },
  { value: 'custom', label: 'Custom' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  government: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  news:       { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  legal:      { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
  social:     { bg: 'rgba(34,197,94,0.15)',  text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  custom:     { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
};

const TRUST_CONFIG: Record<TrustLevel, { label: string; icon: typeof ShieldCheck; activeColor: string; activeBg: string }> = {
  trusted: { label: 'Trusted', icon: ShieldCheck, activeColor: '#4ade80', activeBg: 'rgba(34,197,94,0.2)' },
  default: { label: 'Default', icon: Shield, activeColor: '#94a3b8', activeBg: 'rgba(148,163,184,0.2)' },
  ignored: { label: 'Ignored', icon: ShieldX, activeColor: '#f87171', activeBg: 'rgba(248,113,113,0.2)' },
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SourceRegistryPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyStatuses, setApiKeyStatuses] = useState<Map<string, boolean>>(new Map());
  const [orgId, setOrgId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SourceCategory | 'all'>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // ── Fetch sources + API key statuses ──────────────────────────────
  useEffect(() => {
    if (!orgSlug) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch sources
        const res = await fetch(`/api/analysis/sources?org_slug=${encodeURIComponent(orgSlug)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load sources');
        }
        const data = await res.json();
        setSources(data.sources || []);

        // Resolve org ID for API keys fetch
        const orgsRes = await fetch('/api/intel/orgs');
        if (orgsRes.ok) {
          const memberships = await orgsRes.json();
          const match = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
          if (match) {
            setOrgId(match.org.id);
            // Fetch API key statuses
            const keysRes = await fetch(`/api/shared/api-keys?org_id=${match.org.id}`);
            if (keysRes.ok) {
              const keysData = await keysRes.json();
              const statusMap = new Map<string, boolean>();
              for (const key of (keysData.keys || [])) {
                statusMap.set(key.service_name, key.is_active);
              }
              setApiKeyStatuses(statusMap);
            }
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [orgSlug]);

  // ── Update trust level ────────────────────────────────────────────
  async function updateTrust(sourceId: string, trustLevel: TrustLevel) {
    setUpdatingIds((prev) => new Set(prev).add(sourceId));
    try {
      const res = await fetch(`/api/analysis/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trust_level: trustLevel }),
      });
      if (res.ok) {
        const data = await res.json();
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, ...data.source } : s))
        );
      }
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  }

  // ── Add source ────────────────────────────────────────────────────
  async function addSource(name: string, url: string, category: SourceCategory) {
    const res = await fetch('/api/analysis/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_slug: orgSlug,
        source_name: name,
        source_url: url || null,
        category,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to add source');
    }
    const data = await res.json();
    setSources((prev) => [...prev, data.source]);
  }

  // ── Filtered list ─────────────────────────────────────────────────
  const filtered = sources.filter((s) => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.source_name.toLowerCase().includes(q) ||
        (s.source_url && s.source_url.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--analysis-text)' }}
        >
          Source Registry
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          style={{ backgroundColor: 'var(--analysis-primary)' }}
        >
          <Plus size={16} />
          Add Custom Source
        </button>
      </div>

      <p
        className="text-sm italic opacity-60 mb-8"
        style={{ color: 'var(--analysis-text)' }}
      >
        Manage which sources are trusted, default, or ignored when scoring intelligence data.
      </p>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
            style={{ color: 'var(--analysis-text)' }}
          />
          <input
            type="text"
            placeholder="Search sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'var(--analysis-text)',
            }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as SourceCategory | 'all')}
          className="px-4 py-2.5 rounded-lg border text-sm font-medium focus:outline-none transition-colors appearance-none cursor-pointer"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.1)',
            color: 'var(--analysis-text)',
            minWidth: '140px',
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--analysis-primary)' }} />
          <span className="ml-3 text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
            Loading sources...
          </span>
        </div>
      )}

      {error && !loading && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            borderColor: 'rgba(239,68,68,0.3)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16">
          <Shield size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--analysis-text)' }} />
          <p className="text-sm opacity-50" style={{ color: 'var(--analysis-text)' }}>
            {sources.length === 0 ? 'No sources found. They will be seeded on first load.' : 'No sources match your filters.'}
          </p>
        </div>
      )}

      {/* Source List */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              updating={updatingIds.has(source.id)}
              onTrustChange={(level) => updateTrust(source.id, level)}
              apiKeyStatuses={apiKeyStatuses}
              orgSlug={orgSlug}
            />
          ))}

          <p
            className="text-xs pt-4 opacity-40 text-right"
            style={{ color: 'var(--analysis-text)' }}
          >
            {filtered.length} of {sources.length} source{sources.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddSourceModal
          onClose={() => setShowAddModal(false)}
          onSubmit={addSource}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Row
// ---------------------------------------------------------------------------

function SourceRow({
  source,
  updating,
  onTrustChange,
  apiKeyStatuses,
  orgSlug,
}: {
  source: Source;
  updating: boolean;
  onTrustChange: (level: TrustLevel) => void;
  apiKeyStatuses: Map<string, boolean>;
  orgSlug: string;
}) {
  const catColor = CATEGORY_COLORS[source.category || 'custom'] || CATEGORY_COLORS.custom;
  const serviceName = getServiceForSource(source);
  const hasKey = serviceName ? apiKeyStatuses.has(serviceName) : null;
  const keyActive = serviceName ? (apiKeyStatuses.get(serviceName) ?? false) : false;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border px-4 py-3.5 transition-colors duration-150"
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Left: Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-semibold text-sm truncate"
            style={{ color: 'var(--analysis-text)' }}
          >
            {source.source_name}
          </span>

          {/* Category Badge */}
          {source.category && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: catColor.bg,
                color: catColor.text,
                border: `1px solid ${catColor.border}`,
              }}
            >
              {source.category}
            </span>
          )}

          {/* Built-in Badge */}
          {source.is_default && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                color: 'var(--analysis-text)',
                opacity: 0.5,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Built-in
            </span>
          )}

          {/* API Key Status Indicator */}
          {serviceName !== null && (
            hasKey && keyActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                <Key size={9} />
                Key configured
              </span>
            ) : (
              <Link
                href={`/analysis/${orgSlug}/settings/api-keys`}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                <Key size={9} />
                No key — some data unavailable
              </Link>
            )
          )}
        </div>

        {/* URL */}
        {source.source_url && (
          <a
            href={
              source.source_url.startsWith('http')
                ? source.source_url
                : `https://${source.source_url}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs mt-1 hover:underline transition-opacity opacity-50 hover:opacity-80"
            style={{ color: 'var(--analysis-primary)' }}
          >
            {source.source_url}
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Right: Trust Toggle */}
      <div className="flex items-center gap-0.5 shrink-0">
        {updating && (
          <Loader2
            size={14}
            className="animate-spin mr-2"
            style={{ color: 'var(--analysis-primary)' }}
          />
        )}
        {(Object.entries(TRUST_CONFIG) as [TrustLevel, typeof TRUST_CONFIG.trusted][]).map(
          ([level, config]) => {
            const Icon = config.icon;
            const isActive = source.trust_level === level;
            return (
              <button
                key={level}
                onClick={() => !isActive && onTrustChange(level)}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 disabled:opacity-50"
                style={{
                  backgroundColor: isActive ? config.activeBg : 'transparent',
                  color: isActive ? config.activeColor : 'var(--analysis-text)',
                  opacity: isActive ? 1 : 0.4,
                  border: isActive
                    ? `1px solid ${config.activeColor}40`
                    : '1px solid transparent',
                }}
                title={config.label}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Source Modal
// ---------------------------------------------------------------------------

function AddSourceModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string, url: string, category: SourceCategory) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<SourceCategory>('custom');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      await onSubmit(name.trim(), url.trim(), category);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add source');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    color: 'var(--analysis-text)',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--analysis-bg)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2
            className="text-lg font-bold"
            style={{ color: 'var(--analysis-text)' }}
          >
            Add Custom Source
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'var(--analysis-text)', opacity: 0.5 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Source Name */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--analysis-text)', opacity: 0.5 }}
            >
              Source Name <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ProPublica"
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
              style={inputStyle}
            />
          </div>

          {/* Source URL */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--analysis-text)', opacity: 0.5 }}
            >
              Source URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. propublica.org"
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
              style={inputStyle}
            />
          </div>

          {/* Category */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--analysis-text)', opacity: 0.5 }}
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SourceCategory)}
              className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors appearance-none cursor-pointer"
              style={inputStyle}
            >
              <option value="government">Government</option>
              <option value="news">News</option>
              <option value="legal">Legal</option>
              <option value="social">Social</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm" style={{ color: '#f87171' }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div
            className="flex items-center justify-end gap-3 pt-2"
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'var(--analysis-text)', opacity: 0.7 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: 'var(--analysis-primary)' }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Adding...' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
