'use client';

import { useState } from 'react';
import type { BrandingConfig } from '@/lib/intel/types';

const THEME_PRESETS = [
  { name: 'Midnight', bg: '#0f0f23', text: '#e0e0e0', primary: '#6366f1' },
  { name: 'Slate', bg: '#1e293b', text: '#f1f5f9', primary: '#3b82f6' },
  { name: 'Charcoal', bg: '#1a1a2e', text: '#eaeaea', primary: '#e94560' },
  { name: 'Forest', bg: '#0d1b0e', text: '#d4edda', primary: '#28a745' },
  { name: 'Navy', bg: '#0a192f', text: '#ccd6f6', primary: '#64ffda' },
] as const;

export default function AnalysisBrandingEditor({
  orgId,
  branding,
}: {
  orgId: string;
  branding: BrandingConfig;
}) {
  const [bg, setBg] = useState(branding.background_color);
  const [text, setText] = useState(branding.text_color);
  const [primary, setPrimary] = useState(branding.primary_color);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSave() {
    setSaving(true);
    setMessage('');

    const res = await fetch('/api/analysis/settings/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: orgId,
        branding: {
          background_color: bg,
          text_color: text,
          primary_color: primary,
          logo_url: branding.logo_url,
          tagline: branding.tagline,
        },
      }),
    });

    if (res.ok) {
      setMessage('Branding saved. Refresh to see changes.');
    } else {
      setMessage('Failed to save branding.');
    }
    setSaving(false);
  }

  function applyPreset(preset: (typeof THEME_PRESETS)[number]) {
    setBg(preset.bg);
    setText(preset.text);
    setPrimary(preset.primary);
    setMessage('');
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* ── Controls Column ─────────────────────────────── */}
      <div className="space-y-8">
        {/* Theme Presets */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--analysis-text)', opacity: 0.5 }}
          >
            Theme Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="group relative flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/10 hover:border-white/25 transition-all duration-200"
                style={{ backgroundColor: preset.bg }}
              >
                <span
                  className="w-3 h-3 rounded-full ring-1 ring-white/20"
                  style={{ backgroundColor: preset.primary }}
                />
                <span className="text-xs font-medium" style={{ color: preset.text }}>
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Background Color */}
        <ColorPicker
          label="Background Color"
          value={bg}
          onChange={setBg}
        />

        {/* Text Color */}
        <ColorPicker
          label="Text Color"
          value={text}
          onChange={setText}
        />

        {/* Accent / Primary Color */}
        <ColorPicker
          label="Accent / Primary Color"
          value={primary}
          onChange={setPrimary}
        />

        {/* Message */}
        {message && (
          <p
            className="text-sm font-medium"
            style={{ color: message.includes('Failed') ? '#ef4444' : 'var(--analysis-primary)' }}
          >
            {message}
          </p>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-white text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 hover:brightness-110 active:scale-[0.98]"
          style={{ backgroundColor: primary }}
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>

      {/* ── Live Preview Column ─────────────────────────── */}
      <div>
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--analysis-text)', opacity: 0.5 }}
        >
          Live Preview
        </label>
        <div
          className="rounded-xl border border-white/10 overflow-hidden shadow-2xl"
          style={{ backgroundColor: bg }}
        >
          {/* Preview Header */}
          <div
            className="h-12 flex items-center px-5 gap-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold tracking-tight"
              style={{ backgroundColor: primary }}
            >
              CA
            </div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: text }}>
              Covaled Analysis
            </span>
          </div>

          {/* Preview Body */}
          <div className="p-6 space-y-5">
            {/* Card */}
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: `${primary}30`,
                backgroundColor: `${primary}08`,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: text }}>
                    Profile: Sen. Jane Doe
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: text, opacity: 0.5 }}>
                    Updated 2 hours ago
                  </p>
                </div>
                {/* Badge */}
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${primary}20`,
                    color: primary,
                  }}
                >
                  Active
                </span>
              </div>

              <p className="text-xs leading-relaxed mb-4" style={{ color: text, opacity: 0.7 }}>
                15 data items collected across 4 categories. Soul document is current.
                Next monitoring run scheduled in 6 hours.
              </p>

              {/* Mini Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Data Items', value: '15' },
                  { label: 'Anomalies', value: '2' },
                  { label: 'Sources', value: '8' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="text-center rounded-md py-2"
                    style={{ backgroundColor: `${primary}10` }}
                  >
                    <div className="text-base font-bold" style={{ color: text }}>
                      {stat.value}
                    </div>
                    <div className="text-[10px]" style={{ color: text, opacity: 0.45 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Button */}
            <button
              className="px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all"
              style={{ backgroundColor: primary }}
            >
              View Full Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Color Picker Sub-component ─────────────────────────────────────── */

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        className="block text-sm font-medium mb-2"
        style={{ color: 'var(--analysis-text)' }}
      >
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="w-10 h-10 rounded-lg ring-1 ring-white/15 shadow-inner"
            style={{ backgroundColor: value }}
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white font-mono w-28 focus:outline-none focus:border-white/25 transition-colors"
        />
      </div>
    </div>
  );
}
