'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IntelMemberRole } from '@/lib/intel/types';

interface NavItem {
  label: string;
  href: string;
  enabled: boolean;
  phase?: string;
}

export default function IntelSidebar({
  orgSlug,
  role,
  isOpen,
  onClose,
}: {
  orgSlug: string;
  role: IntelMemberRole;
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const base = `/intel/${orgSlug}`;

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: base, enabled: true },
    { label: 'Briefing', href: `${base}/briefing`, enabled: true },
    { label: 'Chat', href: `${base}/chat`, enabled: true },
    { label: 'Documents', href: `${base}/documents`, enabled: true },
    { label: 'Research', href: `${base}/research`, enabled: true },
    { label: 'Soul Document', href: `${base}/soul-document`, enabled: true },
    { label: 'Calendar', href: `${base}/calendar`, enabled: true },
    { label: 'Stakeholders', href: `${base}/stakeholders`, enabled: true },
    { label: 'Recommendations', href: `${base}/recommendations`, enabled: true },
    { label: 'Trends', href: `${base}/trends`, enabled: true },
    { label: 'Strategic', href: `${base}/strategic`, enabled: true },
    { label: 'Focus Areas', href: `${base}/focus`, enabled: true },
    { label: 'Reports', href: `${base}/reports`, enabled: true },
    { label: 'One-Pagers', href: `${base}/one-pagers`, enabled: true },
  ];

  const settingsItems: NavItem[] = [
    { label: 'Settings', href: `${base}/settings`, enabled: true },
  ];

  function isActive(href: string) {
    if (href === base) return pathname === base;
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
        style={{ backgroundColor: 'var(--intel-bg)' }}
      >
        {/* Logo area */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            CI
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--intel-text)' }}>
            Intelligence
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
                  style={{ color: isActive(item.href) ? 'var(--intel-primary)' : 'var(--intel-text)' }}
                >
                  {item.label}
                </Link>
              ) : (
                <div
                  className="flex items-center gap-3 px-4 py-2.5 text-sm opacity-30 cursor-not-allowed"
                  style={{ color: 'var(--intel-text)' }}
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

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-white/10" />

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
              style={{ color: isActive(item.href) ? 'var(--intel-primary)' : 'var(--intel-text)' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
