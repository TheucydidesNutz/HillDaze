'use client';

import { useState } from 'react';
import IntelSidebar from './IntelSidebar';
import { UploadManagerProvider } from './UploadManager';
import type { BrandingConfig, IntelMemberRole } from '@/lib/intel/types';

interface IntelLayoutProps {
  org: {
    id: string;
    name: string;
    slug: string;
    branding: BrandingConfig;
  };
  member: {
    role: IntelMemberRole;
    display_name: string;
  };
  userEmail: string;
  children: React.ReactNode;
}

export default function IntelLayout({ org, member, userEmail, children }: IntelLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UploadManagerProvider>
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--intel-bg)' }}>
      <IntelSidebar
        orgSlug={org.slug}
        role={member.role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="h-14 border-b border-white/10 flex items-center justify-between px-4 lg:px-6 shrink-0"
          style={{ backgroundColor: 'var(--intel-bg)' }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'var(--intel-text)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <span className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>
              {org.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/intel/${org.slug}/settings`}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'var(--intel-text)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--intel-primary)' }}
              >
                {member.display_name?.charAt(0)?.toUpperCase() || userEmail.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
    </UploadManagerProvider>
  );
}
