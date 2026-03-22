import { redirect } from 'next/navigation';
import { verifyAnalysisAccess } from '@/lib/analysis/middleware';
import { getProfile, getSoulDocument } from '@/lib/analysis/supabase-queries';
import { supabaseAdmin } from '@/lib/supabase';
import VoiceViewer from './VoiceViewer';

/** Extract all unique citation IDs from the soul document content */
function extractCitationIds(content: Record<string, unknown>): string[] {
  const ids = new Set<string>();

  function walk(obj: unknown) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }
    const record = obj as Record<string, unknown>;
    if (record.source_citations && Array.isArray(record.source_citations)) {
      for (const cite of record.source_citations) {
        if (typeof cite === 'string' && cite.length > 8) ids.add(cite);
        if (typeof cite === 'object' && cite !== null) {
          const c = cite as Record<string, unknown>;
          if (typeof c.source_item_id === 'string') ids.add(c.source_item_id);
        }
      }
    }
    for (const val of Object.values(record)) walk(val);
  }

  walk(content);
  return Array.from(ids);
}

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

  // Build source map: resolve citation UUIDs to human-readable metadata
  let sourceMap: Record<string, { title: string; source_name: string; source_url: string | null; item_date: string | null }> = {};
  if (soulDoc?.content) {
    const citationIds = extractCitationIds(soulDoc.content as Record<string, unknown>);
    if (citationIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('analysis_data_items')
        .select('id, title, source_name, source_url, item_date')
        .in('id', citationIds);

      if (items) {
        for (const item of items) {
          sourceMap[item.id] = {
            title: item.title || 'Untitled',
            source_name: item.source_name || 'Unknown source',
            source_url: item.source_url,
            item_date: item.item_date,
          };
        }
      }
    }
  }

  return (
    <VoiceViewer
      profile={profile}
      soulDocument={soulDoc}
      orgSlug={orgSlug}
      verifiedItemCount={count || 0}
      pendingProposalCount={proposalCount || 0}
      sourceMap={sourceMap}
    />
  );
}
