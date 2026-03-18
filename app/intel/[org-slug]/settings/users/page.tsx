import { verifyOrgAccess } from '@/lib/intel/middleware';
import { redirect } from 'next/navigation';
import UserManagement from '@/components/intel/UserManagement';

export default async function UsersPage({
  params,
}: {
  params: Promise<{ 'org-slug': string }>;
}) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;

  if (member.role !== 'super_admin' && member.role !== 'admin') {
    redirect(`/intel/${orgSlug}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--intel-text)] mb-2">User Management</h1>
      <p className="text-sm italic opacity-60 mb-8" style={{ color: 'var(--intel-text)' }}>Manage who has access to this portal. Admins can upload documents, configure feeds, and approve proposals. Users can chat and upload documents. Viewers have read-only access. Only the super admin can manage users and access the reliability dashboard.</p>
      <UserManagement orgId={org.id} currentUserRole={member.role} />
    </div>
  );
}
