import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership, getLatestSoulDocument, saveSoulDocumentVersion } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type Params = { params: Promise<{ 'proposal-id': string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'proposal-id': id } = await params;
  const { data: proposal } = await supabaseAdmin.from('intel_focus_proposals').select('*').eq('id', id).single();
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(proposal.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { action, rejection_reason } = body as { action: 'approve' | 'reject'; rejection_reason?: string };

  if (action === 'reject') {
    await supabaseAdmin.from('intel_focus_proposals').update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq('id', id);
    return NextResponse.json({ status: 'rejected' });
  }

  if (action === 'approve') {
    // Get current soul doc and apply the change
    const soulDoc = await getLatestSoulDocument(proposal.org_id);
    if (!soulDoc) {
      return NextResponse.json({ error: 'No soul document found' }, { status: 400 });
    }

    // Use Claude to apply the proposal to the soul document
    const result = await callClaude({
      system: `You are editing an organization's soul document. Apply the following change while preserving the document's structure and tone. Return the COMPLETE updated document, not just the changed section.`,
      userMessage: `Current document:\n${soulDoc.content}\n\nProposal to apply:\nType: ${proposal.proposal_type}\nDescription: ${proposal.description}\nRationale: ${proposal.rationale}\n\nApply this change and return the full updated document.`,
      maxTokens: 4096,
    });

    await saveSoulDocumentVersion({
      org_id: proposal.org_id,
      content: result.text,
      updated_by: user.id,
    });

    await supabaseAdmin.from('intel_focus_proposals').update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq('id', id);

    return NextResponse.json({ status: 'approved' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
