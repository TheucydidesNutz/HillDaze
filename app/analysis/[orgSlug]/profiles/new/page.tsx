'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const POSITION_TYPES = [
  { value: 'congress_member', label: 'Congress Member', description: 'Senator or Representative' },
  { value: 'jurist', label: 'Jurist', description: 'Judge, justice, or legal official' },
  { value: 'executive', label: 'Executive', description: 'Cabinet member, agency head, or political appointee' },
  { value: 'regulator', label: 'Regulator', description: 'Regulatory agency official' },
  { value: 'other', label: 'Other', description: 'Other public figure' },
] as const;

const PARTIES = ['Democrat', 'Republican', 'Independent'];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','GU','VI','AS','MP',
];

type PositionType = 'congress_member' | 'jurist' | 'executive' | 'regulator' | 'other';

interface FormData {
  full_name: string;
  position_type: PositionType | '';
  party: string;
  state: string;
  district: string;
  court: string;
  organization: string;
  aliases: string[];
}

export default function NewProfilePage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [aliasInput, setAliasInput] = useState('');

  const [form, setForm] = useState<FormData>({
    full_name: '',
    position_type: '',
    party: '',
    state: '',
    district: '',
    court: '',
    organization: '',
    aliases: [],
  });

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/intel/orgs', { cache: 'no-store' });
      if (!res.ok) return;
      const memberships = await res.json();
      const m = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
      if (m) setOrgId(m.org.id);
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => { fetchOrg(); }, [fetchOrg]);

  function updateForm<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addAlias() {
    const trimmed = aliasInput.trim();
    if (trimmed && !form.aliases.includes(trimmed)) {
      updateForm('aliases', [...form.aliases, trimmed]);
    }
    setAliasInput('');
  }

  function removeAlias(alias: string) {
    updateForm('aliases', form.aliases.filter(a => a !== alias));
  }

  function handleAliasKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAlias();
    }
  }

  const canProceed = form.full_name.trim() !== '' && form.position_type !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !form.position_type) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/analysis/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          full_name: form.full_name.trim(),
          position_type: form.position_type,
          party: form.party || undefined,
          state: form.state || undefined,
          district: form.district || undefined,
          court: form.court || undefined,
          organization: form.organization || undefined,
          aliases: form.aliases,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create profile');
      }

      const { profile } = await res.json();
      router.push(`/analysis/${orgSlug}/profiles/${profile.id}/voice`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
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
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--analysis-text)' }}>
          New Profile
        </h1>
        <p className="text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
          Step {step} of 2 &mdash; {step === 1 ? 'Basic Info' : 'Details'}
        </p>

        {/* Progress bar */}
        <div className="mt-4 flex gap-2">
          <div
            className="h-1 flex-1 rounded-full"
            style={{ backgroundColor: 'var(--analysis-primary)' }}
          />
          <div
            className="h-1 flex-1 rounded-full"
            style={{ backgroundColor: step === 2 ? 'var(--analysis-primary)' : 'rgba(255,255,255,0.1)' }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Step 1: Basic Info ───────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Full Name */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--analysis-text)' }}
              >
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={e => updateForm('full_name', e.target.value)}
                placeholder="e.g. Senator Jane Smith"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                style={{
                  color: 'var(--analysis-text)',
                  // @ts-expect-error CSS custom property
                  '--tw-ring-color': 'var(--analysis-primary)',
                }}
              />
            </div>

            {/* Position Type */}
            <div>
              <label
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--analysis-text)' }}
              >
                Position Type <span className="text-red-400">*</span>
              </label>
              <div className="grid gap-3">
                {POSITION_TYPES.map(pt => {
                  const selected = form.position_type === pt.value;
                  return (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => updateForm('position_type', pt.value)}
                      className={`text-left px-4 py-3 rounded-lg border transition-all ${
                        selected
                          ? 'border-transparent ring-2'
                          : 'border-white/10 hover:border-white/20 bg-white/[0.06]'
                      }`}
                      style={
                        selected
                          ? {
                              backgroundColor: 'color-mix(in srgb, var(--analysis-primary) 15%, transparent)',
                              // @ts-expect-error CSS custom property
                              '--tw-ring-color': 'var(--analysis-primary)',
                            }
                          : undefined
                      }
                    >
                      <span
                        className="block text-sm font-medium"
                        style={{ color: 'var(--analysis-text)' }}
                      >
                        {pt.label}
                      </span>
                      <span
                        className="block text-xs mt-0.5 opacity-50"
                        style={{ color: 'var(--analysis-text)' }}
                      >
                        {pt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next button */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => setStep(2)}
                className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--analysis-primary)' }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Contextual Fields ───────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Congress Member fields */}
            {form.position_type === 'congress_member' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                    Party
                  </label>
                  <select
                    value={form.party}
                    onChange={e => updateForm('party', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm focus:outline-none focus:ring-1 focus:border-transparent"
                    style={{
                      color: 'var(--analysis-text)',
                      // @ts-expect-error CSS custom property
                      '--tw-ring-color': 'var(--analysis-primary)',
                    }}
                  >
                    <option value="">Select party...</option>
                    {PARTIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                    State
                  </label>
                  <select
                    value={form.state}
                    onChange={e => updateForm('state', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm focus:outline-none focus:ring-1 focus:border-transparent"
                    style={{
                      color: 'var(--analysis-text)',
                      // @ts-expect-error CSS custom property
                      '--tw-ring-color': 'var(--analysis-primary)',
                    }}
                  >
                    <option value="">Select state...</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                    District <span className="text-xs opacity-40">(optional, for Representatives)</span>
                  </label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={e => updateForm('district', e.target.value)}
                    placeholder="e.g. 7"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                    style={{
                      color: 'var(--analysis-text)',
                      // @ts-expect-error CSS custom property
                      '--tw-ring-color': 'var(--analysis-primary)',
                    }}
                  />
                </div>
              </>
            )}

            {/* Jurist fields */}
            {form.position_type === 'jurist' && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                  Court
                </label>
                <input
                  type="text"
                  value={form.court}
                  onChange={e => updateForm('court', e.target.value)}
                  placeholder='e.g. Supreme Court, 9th Circuit'
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{
                    color: 'var(--analysis-text)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary)',
                  }}
                />
              </div>
            )}

            {/* Executive fields */}
            {form.position_type === 'executive' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                    Organization
                  </label>
                  <input
                    type="text"
                    value={form.organization}
                    onChange={e => updateForm('organization', e.target.value)}
                    placeholder="e.g. Department of Energy"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                    style={{
                      color: 'var(--analysis-text)',
                      // @ts-expect-error CSS custom property
                      '--tw-ring-color': 'var(--analysis-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                    Party <span className="text-xs opacity-40">(optional)</span>
                  </label>
                  <select
                    value={form.party}
                    onChange={e => updateForm('party', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm focus:outline-none focus:ring-1 focus:border-transparent"
                    style={{
                      color: 'var(--analysis-text)',
                      // @ts-expect-error CSS custom property
                      '--tw-ring-color': 'var(--analysis-primary)',
                    }}
                  >
                    <option value="">Select party...</option>
                    {PARTIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Regulator fields */}
            {form.position_type === 'regulator' && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                  Organization
                </label>
                <input
                  type="text"
                  value={form.organization}
                  onChange={e => updateForm('organization', e.target.value)}
                  placeholder="e.g. Federal Trade Commission"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{
                    color: 'var(--analysis-text)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary)',
                  }}
                />
              </div>
            )}

            {/* Other fields */}
            {form.position_type === 'other' && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                  Organization <span className="text-xs opacity-40">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.organization}
                  onChange={e => updateForm('organization', e.target.value)}
                  placeholder="e.g. Brookings Institution"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{
                    color: 'var(--analysis-text)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary)',
                  }}
                />
              </div>
            )}

            {/* Aliases — all types */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>
                Aliases <span className="text-xs opacity-40">(press Enter to add)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aliasInput}
                  onChange={e => setAliasInput(e.target.value)}
                  onKeyDown={handleAliasKeyDown}
                  placeholder="e.g. J. Smith, Jane A. Smith"
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
              {form.aliases.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.aliases.map(alias => (
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
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-colors"
                style={{ color: 'var(--analysis-text)' }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--analysis-primary)' }}
              >
                {submitting ? 'Creating...' : 'Create Profile'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
