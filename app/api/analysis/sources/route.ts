import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership, getOrgBySlug } from '@/lib/intel/supabase-queries';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let orgId = request.nextUrl.searchParams.get('org_id');
  const orgSlug = request.nextUrl.searchParams.get('org_slug');

  // Resolve org_slug to org_id if slug provided
  if (!orgId && orgSlug) {
    const org = await getOrgBySlug(orgSlug);
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    orgId = org.id;
  }

  if (!orgId) return NextResponse.json({ error: 'org_id or org_slug required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Check if sources exist, seed if empty
  const { data: existing, count } = await supabaseAdmin
    .from('analysis_source_registry')
    .select('id', { count: 'exact' })
    .eq('org_id', orgId)
    .limit(1);

  if (!count || count === 0) {
    await supabaseAdmin.rpc('seed_analysis_org_sources', { p_org_id: orgId });
  }

  const { data: sources } = await supabaseAdmin
    .from('analysis_source_registry')
    .select('*')
    .eq('org_id', orgId)
    .order('trust_level')
    .order('source_name');

  return NextResponse.json({ sources: sources || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { source_name, source_url, category } = body;
  let org_id = body.org_id;

  // Resolve org_slug to org_id if slug provided
  if (!org_id && body.org_slug) {
    const org = await getOrgBySlug(body.org_slug);
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    org_id = org.id;
  }

  if (!org_id || !source_name) {
    return NextResponse.json({ error: 'org_id (or org_slug) and source_name required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('analysis_source_registry')
    .insert({
      org_id,
      source_name,
      source_url: source_url || null,
      category: category || 'custom',
      trust_level: 'default',
      is_default: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
  }

  return NextResponse.json({ source: data }, { status: 201 });
}
