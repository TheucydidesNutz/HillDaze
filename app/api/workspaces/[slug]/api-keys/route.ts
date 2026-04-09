import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import { generateApiKey } from '@/lib/analysis/workspace-api-auth';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const orgId = request.nextUrl.searchParams.get('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const workspace = await getWorkspaceBySlug(orgId, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data: keys, error } = await supabaseAdmin
    .from('workspace_api_keys')
    .select('id, key_prefix, name, created_at, last_used_at, expires_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ api_keys: keys || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { org_id, name, expires_in_days } = body as {
    org_id: string;
    name: string;
    expires_in_days?: number;
  };

  if (!org_id || !name) {
    return NextResponse.json({ error: 'org_id and name required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || !['super_admin', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { key, hash, prefix } = generateApiKey();

  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
    : null;

  const { error } = await supabaseAdmin
    .from('workspace_api_keys')
    .insert({
      workspace_id: workspace.id,
      key_hash: hash,
      key_prefix: prefix,
      name,
      created_by: user.id,
      expires_at: expiresAt,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return full key only this once
  return NextResponse.json({
    key,
    prefix,
    name,
    expires_at: expiresAt,
  }, { status: 201 });
}
