import { redirect } from 'next/navigation';
import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import TeamManagement from '@/components/analysis/TeamManagement';

export default async function TeamManagementPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await verifyAnalysisAccess(orgSlug);
  if (!access) redirect('/analysis/login');

  const { org, member } = access;

  if (member.role !== 'super_admin' && member.role !== 'admin') {
    redirect(`/analysis/${orgSlug}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--analysis-text)' }}>
        Team Management
      </h1>
      <p className="text-sm italic opacity-60 mb-8" style={{ color: 'var(--analysis-text)' }}>
        Manage who has access to this analysis portal. Admins can create profiles, manage sources, and review items. Users can view profiles and add data. Viewers have read-only access.
      </p>
      <TeamManagement orgId={org.id} currentUserRole={member.role} />
    </div>
  );
}
