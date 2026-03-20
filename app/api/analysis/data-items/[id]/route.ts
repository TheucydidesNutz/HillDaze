import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: item, error } = await supabaseAdmin
    .from('analysis_data_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: 'Data item not found' }, { status: 404 });
  }

  // Verify membership
  const member = await getUserOrgMembership(item.org_id, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(item);
}
