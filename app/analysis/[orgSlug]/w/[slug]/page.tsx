import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyWorkspaceAccess } from '@/lib/analysis/middleware';
import { supabaseAdmin } from '@/lib/supabase';

export default async function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const access = await verifyWorkspaceAccess(orgSlug, slug);
  if (!access) redirect(`/analysis/${orgSlug}/w`);

  const { workspace } = access;

  // Fetch counts
  const [docCount, convCount, researchCount] = await Promise.all([
    supabaseAdmin.from('workspace_documents').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
    supabaseAdmin.from('workspace_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
    supabaseAdmin.from('workspace_research_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).eq('verification_status', 'unreviewed'),
  ]);

  const stats = [
    { label: 'Documents', value: docCount.count || 0, href: `/analysis/${orgSlug}/w/${slug}/documents` },
    { label: 'Conversations', value: convCount.count || 0, href: `/analysis/${orgSlug}/w/${slug}/chat` },
    { label: 'Unreviewed Items', value: researchCount.count || 0, href: `/analysis/${orgSlug}/w/${slug}/research` },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--analysis-text)' }}>
        {workspace.name}
      </h1>
      {workspace.description && (
        <p className="text-sm mb-6 opacity-60" style={{ color: 'var(--analysis-text)' }}>
          {workspace.description}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="text-2xl font-bold" style={{ color: 'var(--analysis-primary)' }}>
              {stat.value}
            </div>
            <div className="text-sm opacity-60 mt-1" style={{ color: 'var(--analysis-text)' }}>
              {stat.label}
            </div>
          </Link>
        ))}
      </div>

      <div className="p-4 rounded-xl border border-white/10">
        <h2 className="text-sm font-semibold mb-2 opacity-60" style={{ color: 'var(--analysis-text)' }}>
          Soul Doc Status
        </h2>
        <p className="text-sm" style={{ color: 'var(--analysis-text)' }}>
          {workspace.soul_doc_md
            ? `Version ${workspace.soul_doc_version} — Last updated`
            : 'Not yet generated — Upload documents and generate from the Soul Doc page'
          }
        </p>
      </div>
    </div>
  );
}
