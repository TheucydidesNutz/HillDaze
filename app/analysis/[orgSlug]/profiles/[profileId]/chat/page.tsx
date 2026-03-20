import { redirect } from 'next/navigation';
import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import { getProfile } from '@/lib/analysis/supabase-queries';
import AnalysisChatInterface from './AnalysisChatInterface';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ orgSlug: string; profileId: string }>;
}) {
  const { orgSlug, profileId } = await params;
  const access = await verifyAnalysisAccess(orgSlug);
  if (!access) redirect('/analysis/login');

  const profile = await getProfile(profileId);
  if (!profile || profile.org_id !== access.org.id) redirect(`/analysis/${orgSlug}/dashboard`);

  return (
    <AnalysisChatInterface
      profile={{ id: profile.id, full_name: profile.full_name, position_type: profile.position_type }}
      orgId={access.org.id}
      orgName={access.org.name}
      orgSlug={orgSlug}
    />
  );
}
