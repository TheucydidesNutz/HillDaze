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

  const { data: conv } = await supabaseAdmin
    .from('analysis_conversations')
    .select('id, profile_id, org_id, title, created_at')
    .eq('id', id)
    .single();

  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(conv.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: messages } = await supabaseAdmin
    .from('analysis_messages')
    .select('id, role, content, citations, model_used, token_count, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    conversation: conv,
    messages: messages || [],
  });
}
