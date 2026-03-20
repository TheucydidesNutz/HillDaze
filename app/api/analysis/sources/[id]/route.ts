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
  const { trust_level } = body;

  if (!trust_level || !['trusted', 'default', 'ignored'].includes(trust_level)) {
    return NextResponse.json({ error: 'Invalid trust_level' }, { status: 400 });
  }

  // Get source to check org
  const { data: source } = await supabaseAdmin
    .from('analysis_source_registry')
    .select('org_id')
    .eq('id', id)
    .single();

  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

  const member = await getUserOrgMembership(source.org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('analysis_source_registry')
    .update({ trust_level })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });

  return NextResponse.json({ source: data });
}
