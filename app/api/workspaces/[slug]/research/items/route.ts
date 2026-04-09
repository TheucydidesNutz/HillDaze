import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const orgId = request.nextUrl.searchParams.get('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const workspace = await getWorkspaceBySlug(orgId, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const status = request.nextUrl.searchParams.get('status') || undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

  let query = supabaseAdmin
    .from('workspace_research_items')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('verification_status', status);
  if (offset) query = query.range(offset, offset + limit - 1);

  const { data: items, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: items || [] });
}
