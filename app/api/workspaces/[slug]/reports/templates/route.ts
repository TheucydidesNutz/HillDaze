import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';

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

  const { data: templates, error } = await supabaseAdmin
    .from('workspace_report_templates')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ templates: templates || [] });
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

  const { org_id, name, description, output_format, generation_prompt, schedule } = body as {
    org_id: string;
    name: string;
    description?: string;
    output_format?: string;
    generation_prompt?: string;
    schedule?: string;
  };

  if (!org_id || !name) {
    return NextResponse.json({ error: 'org_id and name required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data: template, error } = await supabaseAdmin
    .from('workspace_report_templates')
    .insert({
      workspace_id: workspace.id,
      name,
      description: description || null,
      output_format: output_format || 'md',
      generation_prompt: generation_prompt || null,
      schedule: schedule || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ template }, { status: 201 });
}
