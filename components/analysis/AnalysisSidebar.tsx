'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AnalysisMemberRole } from '@/lib/analysis/types';

interface NavItem {
  label: string;
  href: string;
  enabled: boolean;
  phase?: string;
}

// Extract profileId from pathname like /analysis/[orgSlug]/profiles/[profileId]/...
function extractProfileId(pathname: string, orgSlug: string): string | null {
  const prefix = `/analysis/${orgSlug}/profiles/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const segment = rest.split('/')[0];
  // Must look like a UUID (not "new")
  if (!segment || segment === 'new' || segment.length < 10) return null;
  return segment;
}

export default function AnalysisSidebar({
  orgSlug,
  role,
  isOpen,
  onClose,
}: {
  orgSlug: string;
  role: AnalysisMemberRole;
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const base = `/analysis/${orgSlug}`;

  const profileId = extractProfileId(pathname, orgSlug);
  const profileBase = profileId ? `${base}/profiles/${profileId}` : null;

  // Fetch profile name when inside a profile context
  const [profileName, setProfileName] = useState<string | null>(null);
  useEffect(() => {
    if (!profileId) {
      setProfileName(null);
      return;
    }
    // Fetch profile name from the voice API (lightweight, already cached by browser)
    fetch(`/api/analysis/voice/${profileId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.profile?.full_name) setProfileName(data.profile.full_name);
      })
      .catch(() => {});
  }, [profileId]);

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: base, enabled: true },
    { label: 'Profiles', href: `${base}/profiles`, enabled: true },
  ];

  const profileNavItems: NavItem[] = profileBase ? [
    { label: 'Fact Sheet', href: `${profileBase}/fact-sheet`, enabled: true },
    { label: 'Voice', href: `${profileBase}/voice`, enabled: true },
    { label: 'Data Lake', href: `${profileBase}/data`, enabled: true },
    { label: 'Documents', href: `${profileBase}/documents`, enabled: true },
    { label: 'Chat', href: `${profileBase}/chat`, enabled: true },
    { label: 'Focused Folders', href: `${profileBase}/focused`, enabled: true },
    { label: 'Monitoring', href: `${profileBase}/monitoring`, enabled: true },
    { label: 'Staffers', href: `${profileBase}/staffers`, enabled: true },
  ] : [];

  const settingsItems: NavItem[] = [
    { label: 'Sources', href: `${base}/settings/sources`, enabled: true },
    { label: 'API Keys', href: `${base}/settings/api-keys`, enabled: true },
    { label: 'Anomaly Review', href: `${base}/settings/anomalies`, enabled: true },
    { label: 'Branding', href: `${base}/settings/branding`, enabled: true },
    { label: 'Team', href: `${base}/settings/team`, enabled: true },
  ];

  function isActive(href: string) {
    if (href === base) return pathname === base || pathname === `${base}/dashboard`;
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[260px] z-50 flex flex-col border-r border-white/10 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--analysis-bg)' }}
      >
        {/* Logo area */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: 'var(--analysis-primary)' }}
          >
            CA
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--analysis-text)' }}>
            Analysis
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map((item) => (
            <div key={item.label} className="relative group">
              {item.enabled ? (
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive(item.href)
                      ? 'bg-white/10 font-medium'
                      : 'hover:bg-white/[0.05]'
                  }`}
                  style={{ color: isActive(item.href) ? 'var(--analysis-primary)' : 'var(--analysis-text)' }}
                >
                  {item.label}
                </Link>
              ) : (
                <div
                  className="flex items-center gap-3 px-4 py-2.5 text-sm opacity-30 cursor-not-allowed"
                  style={{ color: 'var(--analysis-text)' }}
                >
                  {item.label}
                  {item.phase && (
                    <span className="ml-auto text-[10px] opacity-60">{item.phase}</span>
                  )}
                </div>
              )}
              {!item.enabled && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50">
                  <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    Coming soon
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Profile section — shown when viewing a specific profile */}
          {profileBase && (
            <>
              <div className="mx-4 my-2 border-t border-white/10" />
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40" style={{ color: 'var(--analysis-text)' }}>
                  Profile
                </span>
              </div>
              {profileName && (
                <div className="px-4 pb-1">
                  <span className="text-xs font-medium truncate block" style={{ color: 'var(--analysis-primary)' }}>
                    {profileName}
                  </span>
                </div>
              )}
              {profileNavItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    isActive(item.href)
                      ? 'bg-white/10 font-medium'
                      : 'hover:bg-white/[0.05]'
                  }`}
                  style={{ color: isActive(item.href) ? 'var(--analysis-primary)' : 'var(--analysis-text)' }}
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}

          {/* Settings divider */}
          <div className="mx-4 my-2 border-t border-white/10" />
          <div className="px-4 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40" style={{ color: 'var(--analysis-text)' }}>
              Settings
            </span>
          </div>

          {settingsItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive(item.href)
                  ? 'bg-white/10 font-medium'
                  : 'hover:bg-white/[0.05]'
              }`}
              style={{ color: isActive(item.href) ? 'var(--analysis-primary)' : 'var(--analysis-text)' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
