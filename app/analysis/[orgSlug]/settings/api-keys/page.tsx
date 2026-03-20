'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Key, Check, X, ExternalLink, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

// ─── Supported Services (client-side duplicate) ─────────────────────

const SUPPORTED_SERVICES = [
  {
    service_name: 'congress_gov',
    display_name: 'Congress.gov API',
    description: 'Bills, votes, members, Congressional Record.',
    category: 'government' as const,
    is_free: true,
    signup_url: 'https://api.congress.gov/sign-up/',
  },
  {
    service_name: 'opensecrets',
    display_name: 'OpenSecrets API',
    description: 'Campaign finance, donations, PAC data.',
    category: 'government' as const,
    is_free: true,
    signup_url: 'https://www.opensecrets.org/api/admin/index.php?function=signup',
  },
  {
    service_name: 'courtlistener',
    display_name: 'CourtListener API',
    description: 'Legal opinions, court filings, judge records.',
    category: 'legal' as const,
    is_free: true,
    signup_url: 'https://www.courtlistener.com/sign-in/',
  },
  {
    service_name: 'pacer',
    display_name: 'PACER',
    description: 'Federal court electronic records.',
    category: 'legal' as const,
    is_free: false,
    signup_url: 'https://pacer.uscourts.gov/register-account',
  },
  {
    service_name: 'listen_notes',
    display_name: 'Listen Notes API',
    description: 'Podcast search and episode data.',
    category: 'media' as const,
    is_free: true,
    signup_url: 'https://www.listennotes.com/api/',
  },
];

type ServiceCategory = 'government' | 'legal' | 'media';

interface StoredKey {
  id: string;
  org_id: string;
  service_name: string;
  masked_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Category Badge Colors ──────────────────────────────────────────

const CATEGORY_STYLES: Record<ServiceCategory, { bg: string; text: string; label: string }> = {
  government: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'Government' },
  legal: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', label: 'Legal' },
  media: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: 'Media' },
};

// ─── Page ───────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  // Org resolution
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  // Stored keys
  const [storedKeys, setStoredKeys] = useState<StoredKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);

  // Modal state
  const [modalService, setModalService] = useState<(typeof SUPPORTED_SERVICES)[number] | null>(null);
  const [modalKeyValue, setModalKeyValue] = useState('');
  const [modalShowKey, setModalShowKey] = useState(false);
  const [modalTesting, setModalTesting] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<'success' | 'failure' | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  // ── Fetch stored keys ─────────────────────────────────────────

  const fetchKeys = useCallback(async () => {
    if (!orgId) return;
    setKeysLoading(true);
    try {
      const res = await fetch(`/api/shared/api-keys?org_id=${orgId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setStoredKeys(Array.isArray(data) ? data : data.keys ?? []);
    } finally {
      setKeysLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) fetchKeys();
  }, [orgId, fetchKeys]);

  // ── Helpers ───────────────────────────────────────────────────

  const getKeyForService = (serviceName: string): StoredKey | undefined =>
    storedKeys.find((k) => k.service_name === serviceName);

  // ── Toggle active/inactive ────────────────────────────────────

  const toggleKeyActive = async (key: StoredKey) => {
    try {
      const res = await fetch(`/api/shared/api-keys/${key.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !key.is_active }),
      });
      if (res.ok) {
        setStoredKeys((prev) =>
          prev.map((k) => (k.id === key.id ? { ...k, is_active: !k.is_active } : k)),
        );
      }
    } catch {
      // silent
    }
  };

  // ── Remove key ────────────────────────────────────────────────

  const removeKey = async (key: StoredKey) => {
    if (!confirm('Remove this API key? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/shared/api-keys/${key.id}`, { method: 'DELETE' });
      if (res.ok) {
        setStoredKeys((prev) => prev.filter((k) => k.id !== key.id));
      }
    } catch {
      // silent
    }
  };

  // ── Modal actions ─────────────────────────────────────────────

  const openModal = (service: (typeof SUPPORTED_SERVICES)[number]) => {
    setModalService(service);
    setModalKeyValue('');
    setModalShowKey(false);
    setModalTesting(false);
    setModalTestResult(null);
    setModalSaving(false);
    setModalError(null);
  };

  const closeModal = () => {
    setModalService(null);
  };

  const testConnection = async () => {
    if (!modalService || !modalKeyValue.trim()) return;
    if (!orgId) {
      setModalError('Organization not resolved. Please reload the page.');
      return;
    }
    setModalTesting(true);
    setModalTestResult(null);
    setModalError(null);
    try {
      const res = await fetch('/api/shared/api-keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          service_name: modalService.service_name,
          api_key: modalKeyValue.trim(),
        }),
      });
      const data = await res.json();
      setModalTestResult(data.success ? 'success' : 'failure');
      if (data.message) setModalError(data.message);
      else if (!data.success) setModalError('Connection test failed.');
    } catch {
      setModalTestResult('failure');
      setModalError('Network error — could not reach the test endpoint.');
    } finally {
      setModalTesting(false);
    }
  };

  const saveKey = async () => {
    if (!modalService || !modalKeyValue.trim()) return;
    if (!orgId) {
      setModalError('Organization not resolved. Please reload the page.');
      return;
    }
    setModalSaving(true);
    setModalError(null);
    try {
      const payload = {
        org_id: orgId,
        service_name: modalService.service_name,
        api_key: modalKeyValue.trim(),
      };
      const res = await fetch('/api/shared/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setModalError(data.error || 'Failed to save API key.');
        return;
      }
      closeModal();
      fetchKeys();
    } catch {
      setModalError('Failed to save API key.');
    } finally {
      setModalSaving(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--analysis-accent)' }} />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="flex items-center gap-2 py-20 justify-center" style={{ color: 'var(--analysis-text)' }}>
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <span className="opacity-70">Unable to resolve organization.</span>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--analysis-text)' }}>
        API Keys
      </h1>
      <p className="text-sm italic opacity-60 mb-8" style={{ color: 'var(--analysis-text)' }}>
        Configure API keys for external data sources. Keys are stored securely and never shown in
        full.
      </p>

      {/* Service Cards */}
      {keysLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--analysis-accent)' }} />
          <span className="ml-2 text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
            Loading API keys...
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {SUPPORTED_SERVICES.map((service) => {
            const existing = getKeyForService(service.service_name);
            const catStyle = CATEGORY_STYLES[service.category];

            return (
              <div
                key={service.service_name}
                className="rounded-lg border p-4"
                style={{
                  backgroundColor: 'var(--analysis-card)',
                  borderColor: 'var(--analysis-border)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm" style={{ color: 'var(--analysis-text)' }}>
                        {service.display_name}
                      </span>

                      {/* Category badge */}
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: catStyle.bg, color: catStyle.text }}
                      >
                        {catStyle.label}
                      </span>

                      {/* Cost indicator */}
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: service.is_free
                            ? 'rgba(34,197,94,0.15)'
                            : 'rgba(245,158,11,0.15)',
                          color: service.is_free ? '#4ade80' : '#fbbf24',
                        }}
                      >
                        {service.is_free ? 'Free' : 'Paid'}
                      </span>
                    </div>

                    <p className="text-xs opacity-60 mb-2" style={{ color: 'var(--analysis-text)' }}>
                      {service.description}
                    </p>

                    {/* Status row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {existing ? (
                        <>
                          {/* Connected / Inactive status */}
                          <span className="flex items-center gap-1.5 text-xs">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{
                                backgroundColor: existing.is_active ? '#4ade80' : '#6b7280',
                              }}
                            />
                            <span
                              style={{
                                color: existing.is_active ? '#4ade80' : '#9ca3af',
                              }}
                            >
                              {existing.is_active ? 'Connected' : 'Inactive'}
                            </span>
                          </span>

                          {/* Masked key */}
                          <span
                            className="text-xs font-mono opacity-50"
                            style={{ color: 'var(--analysis-text)' }}
                          >
                            {existing.masked_key}
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6b7280' }}>
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: '#6b7280' }}
                          />
                          Not configured
                        </span>
                      )}

                      {/* Signup link */}
                      <a
                        href={service.signup_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] flex items-center gap-1 hover:underline"
                        style={{ color: 'var(--analysis-accent)' }}
                      >
                        Get API key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {existing ? (
                      <>
                        {/* Active/Inactive toggle */}
                        <button
                          onClick={() => toggleKeyActive(existing)}
                          className="relative w-9 h-5 rounded-full transition-colors"
                          title={existing.is_active ? 'Deactivate' : 'Activate'}
                          style={{
                            backgroundColor: existing.is_active
                              ? 'var(--analysis-accent)'
                              : '#4b5563',
                          }}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                            style={{
                              left: existing.is_active ? '18px' : '2px',
                            }}
                          />
                        </button>

                        <button
                          onClick={() => openModal(service)}
                          className="text-xs px-3 py-1.5 rounded-md border font-medium transition-colors hover:opacity-80"
                          style={{
                            borderColor: 'var(--analysis-border)',
                            color: 'var(--analysis-text)',
                          }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => removeKey(existing)}
                          className="text-xs px-3 py-1.5 rounded-md border font-medium transition-colors hover:opacity-80"
                          style={{
                            borderColor: 'rgba(239,68,68,0.3)',
                            color: '#f87171',
                          }}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openModal(service)}
                        className="text-xs px-4 py-1.5 rounded-md font-medium transition-colors hover:opacity-90"
                        style={{
                          backgroundColor: 'var(--analysis-accent)',
                          color: '#fff',
                        }}
                      >
                        Configure
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Configure Modal ─────────────────────────────────────────── */}
      {modalService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-[520px] rounded-2xl border shadow-2xl"
            style={{
              backgroundColor: 'var(--analysis-bg, #0f0f23)',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
                >
                  <Key className="w-5 h-5" style={{ color: 'var(--analysis-primary, #6366f1)' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--analysis-text, #e0e0e0)' }}>
                    {modalService.display_name}
                  </h2>
                  <p className="text-xs opacity-50" style={{ color: 'var(--analysis-text, #e0e0e0)' }}>
                    {modalService.description}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 opacity-50" style={{ color: 'var(--analysis-text, #e0e0e0)' }} />
              </button>
            </div>

            {/* Body */}
            <div className="px-7 pb-7 pt-2">
              {/* API key input */}
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-60"
                style={{ color: 'var(--analysis-text, #e0e0e0)' }}
              >
                API Key
              </label>
              <div className="relative mb-2">
                <input
                  type={modalShowKey ? 'text' : 'password'}
                  value={modalKeyValue}
                  onChange={(e) => setModalKeyValue(e.target.value)}
                  placeholder="Paste your API key here"
                  className="w-full text-sm rounded-lg border px-4 py-3 pr-11 outline-none focus:ring-2 font-mono"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: 'var(--analysis-text, #e0e0e0)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary, #6366f1)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setModalShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 transition-colors"
                >
                  {modalShowKey ? (
                    <EyeOff className="w-4 h-4 opacity-40" style={{ color: 'var(--analysis-text, #e0e0e0)' }} />
                  ) : (
                    <Eye className="w-4 h-4 opacity-40" style={{ color: 'var(--analysis-text, #e0e0e0)' }} />
                  )}
                </button>
              </div>

              {/* Help text with signup link */}
              <p className="text-xs opacity-40 mb-5" style={{ color: 'var(--analysis-text, #e0e0e0)' }}>
                {modalService.is_free ? 'Free API key' : 'Paid service'} —{' '}
                <a
                  href={modalService.signup_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--analysis-primary, #6366f1)' }}
                >
                  Get your key at {new URL(modalService.signup_url).hostname.replace('www.', '')}
                </a>
              </p>

              {/* Test result */}
              {modalTestResult && (
                <div
                  className="flex items-start gap-3 text-sm rounded-lg px-4 py-3 mb-5"
                  style={{
                    backgroundColor: modalTestResult === 'success'
                      ? 'rgba(34,197,94,0.1)'
                      : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${modalTestResult === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: modalTestResult === 'success' ? '#4ade80' : '#f87171',
                  }}
                >
                  {modalTestResult === 'success' ? (
                    <Check className="w-5 h-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">
                    {modalTestResult === 'success'
                      ? (modalError || 'Connection successful.')
                      : (modalError || 'Connection test failed.')}
                  </span>
                </div>
              )}

              {/* Modal error (non-test) */}
              {modalError && !modalTestResult && (
                <div
                  className="flex items-start gap-3 text-sm rounded-lg px-4 py-3 mb-5"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                  }}
                >
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{modalError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end pt-2 border-t border-white/5">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:bg-white/[0.05]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: 'var(--analysis-text, #e0e0e0)',
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={testConnection}
                  disabled={!modalKeyValue.trim() || modalTesting}
                  className="px-5 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: 'var(--analysis-text, #e0e0e0)',
                  }}
                >
                  {modalTesting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing...
                    </span>
                  ) : (
                    'Test Connection'
                  )}
                </button>

                <button
                  onClick={saveKey}
                  disabled={!modalKeyValue.trim() || modalSaving}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--analysis-primary, #6366f1)' }}
                >
                  {modalSaving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save Key'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
