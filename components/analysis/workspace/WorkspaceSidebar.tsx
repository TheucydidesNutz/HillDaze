'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
}

export default function WorkspaceSidebar({
  orgSlug,
  workspaceSlug,
  workspaceName,
  isOpen,
  onClose,
}: {
  orgSlug: string;
  workspaceSlug: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const base = `/analysis/${orgSlug}/w/${workspaceSlug}`;

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: base },
    { label: 'Documents', href: `${base}/documents` },
    { label: 'Chat', href: `${base}/chat` },
    { label: 'Soul Doc', href: `${base}/soul-doc` },
    { label: 'Reports', href: `${base}/reports` },
    { label: 'Research', href: `${base}/research` },
    { label: 'Settings', href: `${base}/settings` },
  ];

  function isActive(href: string) {
    if (href === base) return pathname === base;
    return pathname.startsWith(href);
  }

  return (
    <>
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
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
              style={{ backgroundColor: 'var(--analysis-primary)' }}
            >
              W
            </div>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--analysis-text)' }}>
              {workspaceName}
            </span>
          </div>
          <Link
            href={`/analysis/${orgSlug}/w`}
            className="mt-2 flex items-center gap-1.5 text-xs opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--analysis-text)' }}
          >
            &larr; All Workspaces
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map((item) => (
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
