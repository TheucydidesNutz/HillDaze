import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type Params = { params: Promise<{ 'target-id': string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': targetId } = await params;
  const { data: target } = await supabaseAdmin.from('intel_research_targets').select('org_id').eq('id', targetId).single();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(target.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('intel_research_target_documents')
    .select('*, document:intel_documents(*)')
    .eq('target_id', targetId);

  return NextResponse.json((data || []).map((d: Record<string, unknown>) => d.document).filter(Boolean));
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': targetId } = await params;
  const { document_id } = await request.json();

  const { data: target } = await supabaseAdmin.from('intel_research_targets').select('org_id').eq('id', targetId).single();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(target.org_id, user.id);
  if (!member || member.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin.from('intel_research_target_documents').insert({ target_id: targetId, document_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': targetId } = await params;
  const { document_id } = await request.json();

  await supabaseAdmin.from('intel_research_target_documents').delete().eq('target_id', targetId).eq('document_id', document_id);
  return NextResponse.json({ success: true });
}
