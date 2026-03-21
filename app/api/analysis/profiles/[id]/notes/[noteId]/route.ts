import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { noteId } = await params;

  const { data: note } = await supabaseAdmin
    .from('analysis_profile_notes')
    .select('id, org_id')
    .eq('id', noteId)
    .single();

  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(note.org_id, user.id);
  if (!member || member.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await supabaseAdmin
    .from('analysis_profile_notes')
    .delete()
    .eq('id', noteId);

  return NextResponse.json({ success: true });
}
