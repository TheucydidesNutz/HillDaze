import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import { getOrgWorkspaces } from '@/lib/analysis/workspace-queries';
import { getAnalysisBrandingStyles } from '@/lib/analysis/branding';

export default async function WorkspacesListPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await verifyAnalysisAccess(orgSlug);
  if (!access) redirect('/analysis/login');

  const { org, member } = access;
  const workspaces = await getOrgWorkspaces(org.id);
  const brandingStyles = getAnalysisBrandingStyles(org.branding);

  return (
    <div style={brandingStyles} className="min-h-screen p-8" data-bg="true">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href={`/analysis/${orgSlug}`}
              className="text-xs opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--analysis-text)' }}
            >
              &larr; Back to Analysis
            </Link>
            <h1 className="text-2xl font-bold mt-2" style={{ color: 'var(--analysis-text)' }}>
              Workspaces
            </h1>
            <p className="text-sm mt-1 opacity-60" style={{ color: 'var(--analysis-text)' }}>
              Isolated environments for different projects and clients
            </p>
          </div>

          {member.role !== 'viewer' && (
            <Link
              href={`/analysis/${orgSlug}/w/new`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--analysis-primary)' }}
            >
              New Workspace
            </Link>
          )}
        </div>

        {workspaces.length === 0 ? (
          <div className="text-center py-16 opacity-50" style={{ color: 'var(--analysis-text)' }}>
            <p className="text-lg">No workspaces yet</p>
            <p className="text-sm mt-1">Create one to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/analysis/${orgSlug}/w/${ws.slug}`}
                className="block p-5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                style={{ backgroundColor: 'var(--analysis-bg)' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--analysis-text)' }}>
                      {ws.name}
                    </h3>
                    {ws.description && (
                      <p className="text-sm mt-1 opacity-60" style={{ color: 'var(--analysis-text)' }}>
                        {ws.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs opacity-40" style={{ color: 'var(--analysis-text)' }}>
                    {new Date(ws.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
