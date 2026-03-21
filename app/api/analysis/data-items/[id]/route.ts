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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: item, error } = await supabaseAdmin
    .from('analysis_data_items')
    .select('id, org_id, storage_path')
    .eq('id', id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: 'Data item not found' }, { status: 404 });
  }

  // Verify membership (viewers cannot delete)
  const member = await getUserOrgMembership(item.org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete file from storage if it exists
  if (item.storage_path) {
    await supabaseAdmin.storage.from('analysis').remove([item.storage_path]);
  }

  // Delete the database record
  const { error: deleteError } = await supabaseAdmin
    .from('analysis_data_items')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete data item' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
