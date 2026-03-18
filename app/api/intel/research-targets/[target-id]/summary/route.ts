import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership, getLatestSoulDocument } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'target-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': targetId } = await params;
  const { data: target } = await supabaseAdmin.from('intel_research_targets').select('org_id').eq('id', targetId).single();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(target.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('intel_research_target_summaries')
    .select('*')
    .eq('target_id', targetId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ 'target-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'target-id': targetId } = await params;
  const { data: target } = await supabaseAdmin.from('intel_research_targets').select('*').eq('id', targetId).single();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(target.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Gather context
  const [soulDoc, docsResult, newsResult, stakeholdersResult, prevSummary] = await Promise.all([
    getLatestSoulDocument(target.org_id),
    supabaseAdmin.from('intel_research_target_documents').select('document:intel_documents(*)').eq('target_id', targetId).then(r => r.data),
    supabaseAdmin.from('intel_research_target_news').select('news_item:intel_news_items(*)').eq('target_id', targetId).order('matched_at', { ascending: false }).limit(50).then(r => r.data),
    supabaseAdmin.from('intel_research_target_stakeholders').select('stakeholder:intel_stakeholders(*)').eq('target_id', targetId).then(r => r.data),
    supabaseAdmin.from('intel_research_target_summaries').select('*').eq('target_id', targetId).order('version', { ascending: false }).limit(1).single().then(r => r.data),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docs = (docsResult || []).map((d: any) => d.document).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const news = (newsResult || []).map((n: any) => n.news_item).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stakeholders = (stakeholdersResult || []).map((s: any) => s.stakeholder).filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docsText = docs.map((d: any) => `- "${d.summary_metadata?.title || d.filename}": ${(d.summary || '').substring(0, 300)}`).join('\n') || 'No linked documents.';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newsText = news.map((n: any) => `- [${n.source_type}] "${n.title}": ${(n.summary || n.raw_content || '').substring(0, 200)}`).join('\n') || 'No matched news items.';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stakeholderText = stakeholders.map((s: any) => `- ${s.name} (${s.title || s.role_type}, ${s.organization || 'Unknown'})`).join('\n') || 'No linked stakeholders.';
  const prevContent = prevSummary?.content || '';
  const prevVersion = prevSummary?.version || 0;

  const model = 'claude-sonnet-4-20250514';
  const result = await callClaude({
    system: `You are a research analyst producing a structured intelligence brief on: "${target.name}".

Organization context:
${soulDoc?.content?.substring(0, 500) || 'No soul document.'}

Target description: ${target.description}
Tracking brief: ${target.tracking_brief || 'No specific tracking instructions.'}

Linked documents:
${docsText}

Matched news items (last 90 days):
${newsText}

Related stakeholders:
${stakeholderText}

${prevContent ? `Previous summary (v${prevVersion}) for continuity — update and build on this, don't start from scratch:\n${prevContent}` : 'This is the first summary — create a comprehensive initial brief.'}

Generate a structured research brief in markdown with these sections:
## Landscape Overview
## Key Players
## Recent Developments
## Emerging Trends
## Papers & Research
## Market Activity
## Regulatory Implications
## Open Questions
## Recommended Actions

Be specific, cite sources, and provide actionable intelligence.`,
    userMessage: 'Generate the research brief now.',
    model,
    maxTokens: 4096,
  });

  await logApiUsage({ orgId: target.org_id, endpoint: 'research_summary', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  const newVersion = prevVersion + 1;
  const { data: summary, error } = await supabaseAdmin.from('intel_research_target_summaries').insert({
    target_id: targetId,
    org_id: target.org_id,
    version: newVersion,
    content: result.text,
    doc_count: docs.length,
    news_count: news.length,
    generated_at: new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(summary, { status: 201 });
}
