import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { removeOrgApiKey, toggleOrgApiKey } from '@/lib/shared/org-api-keys';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Get key to check org
  const { data: key } = await supabaseAdmin
    .from('org_api_keys')
    .select('org_id')
    .eq('id', id)
    .single();

  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(key.org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const success = await removeOrgApiKey(id);
  if (!success) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const { data: key } = await supabaseAdmin
    .from('org_api_keys')
    .select('org_id')
    .eq('id', id)
    .single();

  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(key.org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (typeof body.is_active === 'boolean') {
    const success = await toggleOrgApiKey(id, body.is_active);
    if (!success) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
