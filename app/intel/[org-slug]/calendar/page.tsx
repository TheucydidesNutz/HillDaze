import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import CalendarView from '@/components/intel/CalendarView';

export default async function CalendarPage({ params }: { params: Promise<{ 'org-slug': string }> }) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--intel-text)' }}>Regulatory Calendar</h1>
      <p className="text-sm italic opacity-60 mb-6" style={{ color: 'var(--intel-text)' }}>Regulatory deadlines, hearings, votes, and rulemaking milestones extracted automatically from monitored sources. Add manual entries for events the analyst can&apos;t detect. The analyst references these in chat and strategic recommendations.</p>
      <CalendarView orgId={org.id} isAdmin={isAdmin} />
    </div>
  );
}
