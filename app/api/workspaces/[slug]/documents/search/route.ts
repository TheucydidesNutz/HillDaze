import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import { searchWorkspaceChunks } from '@/lib/analysis/workspace-rag';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { org_id, query, match_count, threshold } = body as {
    org_id: string;
    query: string;
    match_count?: number;
    threshold?: number;
  };

  if (!org_id || !query) {
    return NextResponse.json({ error: 'org_id and query required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const chunks = await searchWorkspaceChunks(workspace.id, query, {
    matchCount: match_count,
    threshold,
  });

  return NextResponse.json({ chunks });
}
