import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getProfile } from '@/lib/analysis/supabase-queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; proposalId: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { profileId, proposalId } = await params;
  const body = await request.json();
  const { action } = body as { action: 'approve' | 'reject' };

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const member = await getUserOrgMembership(profile.org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get proposal
  const { data: proposal } = await supabaseAdmin
    .from('analysis_soul_document_proposals')
    .select('*')
    .eq('id', proposalId)
    .single();

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  if (action === 'approve') {
    // Get current soul document
    const { data: soulDoc } = await supabaseAdmin
      .from('analysis_soul_documents')
      .select('*')
      .eq('id', proposal.soul_document_id)
      .single();

    if (soulDoc) {
      // Merge proposed changes into existing content
      const currentContent = (soulDoc.content || {}) as Record<string, unknown>;
      const proposedChanges = proposal.proposed_changes as Record<string, unknown>;
      const mergedContent = { ...currentContent, ...proposedChanges };

      await supabaseAdmin
        .from('analysis_soul_documents')
        .update({
          content: mergedContent,
          version: soulDoc.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', soulDoc.id);
    }
  }

  // Update proposal status
  await supabaseAdmin
    .from('analysis_soul_document_proposals')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  return NextResponse.json({ status: action === 'approve' ? 'approved' : 'rejected' });
}
