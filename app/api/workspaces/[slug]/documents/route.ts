import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug, getWorkspaceDocuments } from '@/lib/analysis/workspace-queries';

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

  const folder = request.nextUrl.searchParams.get('folder') || undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

  const documents = await getWorkspaceDocuments(workspace.id, { folder, limit, offset });
  return NextResponse.json({ documents });
}
