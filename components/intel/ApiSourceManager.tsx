'use client';

import { useState, useEffect, useCallback } from 'react';

interface SourceConfig {
  id: string;
  source_type: string;
  api_key: string | null;
  search_terms: string[];
  filters: Record<string, unknown>;
  active: boolean;
  last_fetched_at: string | null;
}

const SOURCE_CONFIGS = [
  {
    type: 'federal_register',
    title: 'Federal Register',
    description: 'No API key needed. Search final rules, proposed rules, notices, and presidential documents.',
    needsKey: false,
    filterOptions: {
      document_types: ['rules', 'proposed_rules', 'notices', 'presidential_documents'],
    },
    ingestEndpoint: '/api/intel/ingest/federal-register',
  },
  {
    type: 'congress_gov',
    title: 'Congress.gov',
    description: 'Requires a free API key from api.congress.gov',
    needsKey: true,
    filterOptions: {},
    ingestEndpoint: '/api/intel/ingest/congress',
  },
  {
    type: 'regulations_gov',
    title: 'Regulations.gov',
    description: 'Requires a free API key from api.data.gov',
    needsKey: true,
    filterOptions: {},
    ingestEndpoint: '/api/intel/ingest/regulations',
  },
];

export default function ApiSourceManager({ orgId }: { orgId: string }) {
  const [configs, setConfigs] = useState<SourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, { api_key: string; search_terms: string; filters: Record<string, unknown> }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const fetchConfigs = useCallback(async () => {
    const res = await fetch(`/api/intel/api-sources?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setConfigs(data);
      const f: Record<string, { api_key: string; search_terms: string; filters: Record<string, unknown> }> = {};
      for (const src of SOURCE_CONFIGS) {
        const existing = data.find((c: SourceConfig) => c.source_type === src.type);
        f[src.type] = {
          api_key: existing?.api_key || '',
          search_terms: (existing?.search_terms || []).join(', '),
          filters: existing?.filters || {},
        };
      }
      setForms(f);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  async function saveConfig(sourceType: string) {
    setSaving(sourceType);
    setMessage('');
    const form = forms[sourceType];
    const res = await fetch('/api/intel/api-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: orgId,
        source_type: sourceType,
        api_key: form.api_key || null,
        search_terms: form.search_terms.split(',').map(s => s.trim()).filter(Boolean),
        filters: form.filters,
      }),
    });
    if (res.ok) setMessage(`${sourceType} configuration saved`);
    setSaving(null);
    fetchConfigs();
  }

  async function testAndFetch(sourceType: string, endpoint: string) {
    setFetching(sourceType);
    setMessage('');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessage(`${sourceType}: ${data.items_added} new items fetched`);
      fetchConfigs();
    } else {
      setMessage(`${sourceType}: Fetch failed`);
    }
    setFetching(null);
  }

  function updateForm(type: string, field: string, value: string) {
    setForms(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  function toggleFilter(type: string, filterKey: string, val: string) {
    setForms(prev => {
      const current = (prev[type].filters[filterKey] as string[]) || [];
      const updated = current.includes(val)
        ? current.filter(v => v !== val)
        : [...current, val];
      return { ...prev, [type]: { ...prev[type], filters: { ...prev[type].filters, [filterKey]: updated } } };
    });
  }

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm" style={{ color: 'var(--intel-primary)' }}>{message}</div>
      )}

      {SOURCE_CONFIGS.map(src => {
        const existing = configs.find(c => c.source_type === src.type);
        const form = forms[src.type] || { api_key: '', search_terms: '', filters: {} };

        return (
          <div key={src.type} className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--intel-text)' }}>{src.title}</h3>
                <p className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--intel-text)' }}>{src.description}</p>
              </div>
              {existing && (
                <span className="text-[10px] opacity-30" style={{ color: 'var(--intel-text)' }}>
                  Last: {existing.last_fetched_at ? new Date(existing.last_fetched_at).toLocaleDateString() : 'Never'}
                </span>
              )}
            </div>

            <div className="space-y-3">
              {src.needsKey && (
                <div>
                  <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>API Key</label>
                  <input
                    type="password"
                    value={form.api_key}
                    onChange={e => updateForm(src.type, 'api_key', e.target.value)}
                    placeholder="Enter API key"
                    className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1 opacity-60" style={{ color: 'var(--intel-text)' }}>Search Terms (comma separated)</label>
                <input
                  type="text"
                  value={form.search_terms}
                  onChange={e => updateForm(src.type, 'search_terms', e.target.value)}
                  placeholder="e.g., BVLOS, drone, UAS, agricultural technology"
                  className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {src.filterOptions.document_types && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: 'var(--intel-text)' }}>Document Types</label>
                  <div className="flex flex-wrap gap-2">
                    {src.filterOptions.document_types.map(dt => {
                      const selected = ((form.filters.document_types as string[]) || []).includes(dt);
                      return (
                        <button
                          key={dt}
                          onClick={() => toggleFilter(src.type, 'document_types', dt)}
                          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                            selected ? 'border-[var(--intel-primary)] bg-[var(--intel-primary)]/20' : 'border-white/10 hover:border-white/20'
                          }`}
                          style={{ color: selected ? 'var(--intel-primary)' : 'var(--intel-text)' }}
                        >
                          {dt.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => saveConfig(src.type)}
                  disabled={saving === src.type}
                  className="px-4 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: 'var(--intel-primary)' }}
                >
                  {saving === src.type ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => testAndFetch(src.type, src.ingestEndpoint)}
                  disabled={fetching === src.type}
                  className="px-4 py-2 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05] disabled:opacity-40"
                  style={{ color: 'var(--intel-text)' }}
                >
                  {fetching === src.type ? 'Fetching...' : 'Test & Fetch'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
