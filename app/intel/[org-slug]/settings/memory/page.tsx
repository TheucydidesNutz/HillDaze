import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import MemoryManager from '@/components/intel/MemoryManager';

export default async function MemoryPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  if (member.role !== 'super_admin' && member.role !== 'admin') {
    redirect(`/intel/${orgSlug}/settings`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Agent Memory</h1>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>The Intelligence Analyst&apos;s accumulated observations from conversations, documents, and analysis. These persistent memories carry forward across sessions, helping the analyst recognize patterns and remember decisions. Review, edit, or archive memories to keep the analyst&apos;s knowledge accurate.</p>
      <MemoryManager orgId={org.id} />
    </div>
  );
}
