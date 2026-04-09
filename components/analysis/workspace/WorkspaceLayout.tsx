'use client';

import { useState } from 'react';
import WorkspaceSidebar from './WorkspaceSidebar';

interface WorkspaceLayoutProps {
  orgSlug: string;
  orgName: string;
  workspaceSlug: string;
  workspaceName: string;
  memberDisplayName: string;
  children: React.ReactNode;
}

export default function WorkspaceLayout({
  orgSlug,
  orgName,
  workspaceSlug,
  workspaceName,
  memberDisplayName,
  children,
}: WorkspaceLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--analysis-bg)' }}>
      <WorkspaceSidebar
        orgSlug={orgSlug}
        workspaceSlug={workspaceSlug}
        workspaceName={workspaceName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 border-b border-white/10 flex items-center justify-between px-4 lg:px-6 shrink-0"
          style={{ backgroundColor: 'var(--analysis-bg)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'var(--analysis-text)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <span className="text-sm" style={{ color: 'var(--analysis-text)', opacity: 0.5 }}>
              {orgName}
            </span>
            <span className="text-sm" style={{ color: 'var(--analysis-text)', opacity: 0.3 }}>/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--analysis-text)' }}>
              {workspaceName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--analysis-primary)' }}
            >
              {memberDisplayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
