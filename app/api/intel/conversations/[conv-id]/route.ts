import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getConversation, deleteConversation, getUserOrgMembership } from '@/lib/intel/supabase-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type RouteParams = { params: Promise<{ 'conv-id': string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'conv-id': convId } = await params;
  const conv = await getConversation(convId);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(conv.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (conv.user_id !== user.id && member.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(conv);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'conv-id': convId } = await params;
  const conv = await getConversation(convId);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (conv.user_id !== user.id) {
    const member = await getUserOrgMembership(conv.org_id, user.id);
    if (!member || member.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const success = await deleteConversation(convId);
  if (!success) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  return NextResponse.json({ success: true });
}
