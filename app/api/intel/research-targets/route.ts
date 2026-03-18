import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('intel_research_targets')
    .select('*, intel_research_target_summaries(generated_at, version), intel_research_target_documents(id), intel_research_target_news(id)')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  const enriched = (data || []).map((t: Record<string, unknown>) => ({
    ...t,
    doc_count: Array.isArray(t.intel_research_target_documents) ? t.intel_research_target_documents.length : 0,
    news_count: Array.isArray(t.intel_research_target_news) ? t.intel_research_target_news.length : 0,
    last_summary: Array.isArray(t.intel_research_target_summaries) && t.intel_research_target_summaries.length > 0
      ? t.intel_research_target_summaries[0] : null,
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, name, description, tracking_brief, search_terms, icon } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const { data, error } = await supabaseAdmin.from('intel_research_targets').insert({
    org_id,
    name,
    slug,
    description,
    tracking_brief: tracking_brief || null,
    search_terms: search_terms || [],
    icon: icon || null,
    status: 'active',
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
