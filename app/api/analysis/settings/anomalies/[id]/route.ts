import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || !['verified', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be "verified" or "rejected"' }, { status: 400 });
  }

  // Get item to check org
  const { data: item } = await supabaseAdmin
    .from('analysis_data_items')
    .select('org_id')
    .eq('id', id)
    .single();

  if (!item) return NextResponse.json({ error: 'Data item not found' }, { status: 404 });

  const member = await getUserOrgMembership(item.org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('analysis_data_items')
    .update({
      verification_status: status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });

  return NextResponse.json({ item: data });
}
