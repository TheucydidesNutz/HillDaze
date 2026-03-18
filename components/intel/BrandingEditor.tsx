'use client';

import { useState, useRef } from 'react';
import type { BrandingConfig } from '@/lib/intel/types';

export default function BrandingEditor({
  orgId,
  branding,
}: {
  orgId: string;
  branding: BrandingConfig;
}) {
  const [bg, setBg] = useState(branding.background_color);
  const [text, setText] = useState(branding.text_color);
  const [primary, setPrimary] = useState(branding.primary_color);
  const [logoUrl, setLogoUrl] = useState(branding.logo_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage('Logo must be under 2MB');
      return;
    }

    if (!['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage('Logo must be PNG, SVG, JPEG, or WebP');
      return;
    }

    setUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/intel/orgs/${orgId}?action=upload-logo`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setLogoUrl(data.logo_url);
      setMessage('Logo uploaded');
    } else {
      setMessage('Logo upload failed');
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');

    const res = await fetch(`/api/intel/orgs/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branding: {
          background_color: bg,
          text_color: text,
          primary_color: primary,
          logo_url: logoUrl,
          tagline: branding.tagline,
        },
      }),
    });

    if (res.ok) {
      setMessage('Branding saved. Refresh to see changes.');
    } else {
      setMessage('Failed to save branding');
    }
    setSaving(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Controls */}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--intel-text)' }}>
            Background Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
            />
            <input
              type="text"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
              className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white font-mono w-28"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--intel-text)' }}>
            Text Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
            />
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white font-mono w-28"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--intel-text)' }}>
            Primary / Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
            />
            <input
              type="text"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white font-mono w-28"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--intel-text)' }}>
            Logo (PNG or SVG, max 2MB)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm bg-white/[0.06] border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'var(--intel-text)' }}
            >
              {uploading ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
            </button>
          </div>
        </div>

        {message && (
          <p className="text-sm" style={{ color: 'var(--intel-primary)' }}>
            {message}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--intel-primary)' }}
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>

      {/* Live Preview */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--intel-text)' }}>
          Live Preview
        </h3>
        <div
          className="rounded-xl border border-white/10 overflow-hidden"
          style={{ backgroundColor: bg }}
        >
          {/* Preview header */}
          <div className="h-12 border-b border-white/10 flex items-center px-4 gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-6 h-6 rounded object-cover" />
            ) : (
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: primary }}
              >
                CI
              </div>
            )}
            <span className="text-sm font-medium" style={{ color: text }}>
              Organization Name
            </span>
          </div>

          {/* Preview body */}
          <div className="p-6">
            <h2 className="text-lg font-bold mb-3" style={{ color: text }}>
              Dashboard Preview
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {['Approvals', 'Trends', 'Reports', 'Activity'].map((label) => (
                <div
                  key={label}
                  className="p-4 rounded-lg border border-white/10"
                  style={{ backgroundColor: `${primary}10` }}
                >
                  <div className="text-xs mb-1" style={{ color: text, opacity: 0.6 }}>
                    {label}
                  </div>
                  <div className="text-base font-semibold" style={{ color: text }}>
                    0
                  </div>
                </div>
              ))}
            </div>
            <button
              className="mt-4 px-4 py-2 text-sm rounded-lg text-white"
              style={{ backgroundColor: primary }}
            >
              Sample Button
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
