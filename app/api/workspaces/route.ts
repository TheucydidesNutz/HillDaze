import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { createWorkspace, getOrgWorkspaces } from '@/lib/analysis/workspace-queries';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const workspaces = await getOrgWorkspaces(orgId);
  return NextResponse.json({ workspaces });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { org_id, name, description } = body as {
    org_id: string;
    name: string;
    description?: string;
  };

  if (!org_id || !name) {
    return NextResponse.json({ error: 'org_id and name required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await createWorkspace({
    org_id,
    name,
    description,
    created_by: user.id,
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }

  return NextResponse.json({ workspace }, { status: 201 });
}
