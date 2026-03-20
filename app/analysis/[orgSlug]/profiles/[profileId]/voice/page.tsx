import { redirect } from 'next/navigation';
import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import { getProfile, getSoulDocument } from '@/lib/analysis/supabase-queries';
import { supabaseAdmin } from '@/lib/supabase';
import VoiceViewer from './VoiceViewer';

export default async function VoiceProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string; profileId: string }>;
}) {
  const { orgSlug, profileId } = await params;
  const access = await verifyAnalysisAccess(orgSlug);
  if (!access) redirect('/analysis/login');

  const profile = await getProfile(profileId);
  if (!profile || profile.org_id !== access.org.id) redirect(`/analysis/${orgSlug}/dashboard`);

  const soulDoc = await getSoulDocument(profileId);

  // Get verified item count
  const { count } = await supabaseAdmin
    .from('analysis_data_items')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('verification_status', 'verified');

  // Get pending proposals count
  const { count: proposalCount } = await supabaseAdmin
    .from('analysis_soul_document_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', access.org.id)
    .eq('status', 'pending');

  return (
    <VoiceViewer
      profile={profile}
      soulDocument={soulDoc}
      orgSlug={orgSlug}
      verifiedItemCount={count || 0}
      pendingProposalCount={proposalCount || 0}
    />
  );
}
