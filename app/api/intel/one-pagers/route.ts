import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { gatherGenerationContext } from '@/lib/intel/agent/gather-context';
import { generateOnePagerDocx } from '@/lib/intel/reports/generate-one-pager-docx';
import type { OnePagerContent } from '@/lib/intel/reports/generate-one-pager-docx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('intel_one_pagers')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, topic, audience, specific_ask, key_data_points } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ctx = await gatherGenerationContext(org_id);
  const model = 'claude-sonnet-4-20250514';

  const audienceGuidance: Record<string, string> = {
    'Congressional Staff': 'Be policy-literate and reference specific legislation by name and number. Staffers know the process — don\'t over-explain.',
    'State Legislators': 'Reference state-specific impacts. Use concrete local examples and economic data.',
    'Regulators/Agency Officials': 'Be technically precise. Reference specific dockets, rules, and regulatory authority. Acknowledge the regulatory framework respectfully.',
    'Media': 'Lead with the newsworthy angle. Include quotable language. Frame the story, don\'t just state positions.',
    'Industry/Trade Partners': 'Emphasize shared interests and coalition value. Be specific about mutual benefits.',
    'General/Executive': 'Use plain language. Focus on impact and bottom line. Avoid jargon.',
  };

  const systemPrompt = `You are a professional advocacy communications writer for ${ctx.orgName}.

Organization background and positions:
${ctx.soulDocContent}

Relevant documents and research:
${ctx.docSummaries}

Recent developments:
${ctx.newsText}

Generate a one-pager advocacy brief. This is a single-page document (approximately 400-500 words maximum) meant to be printed on one page and left behind after a meeting or handed out at an event.

Target audience: ${audience}
${specific_ask ? `Specific ask: ${specific_ask}` : ''}
${key_data_points ? `Key data points to incorporate: ${key_data_points}` : ''}

Structure the one-pager EXACTLY as follows (return as JSON):

{
  "headline": "A compelling, action-oriented headline (8-12 words max)",
  "subheadline": "One sentence framing the urgency or importance",
  "the_issue": "2-3 sentences explaining the problem or situation. Clear, concise, no jargon unless the audience expects it.",
  "our_position": "2-3 sentences stating the organization's position firmly and clearly.",
  "key_points": [
    "Supporting point 1 — one sentence with a specific fact, data point, or argument",
    "Supporting point 2 — same format",
    "Supporting point 3 — same format",
    "Supporting point 4 (optional) — same format"
  ],
  "pullout_stat": {
    "number": "The single most compelling statistic or data point",
    "context": "One sentence explaining what it means"
  },
  "the_ask": "1-2 sentences stating exactly what you want the reader to do. Be specific and direct.",
  "contact": {
    "name": "Contact person name",
    "title": "Their title",
    "email": "Contact email",
    "phone": "Contact phone (if available)"
  }
}

Writing guidelines:
- Use the organization's voice from the soul document
- ${audienceGuidance[audience] || ''}
- Every word must earn its place — this must fit on one printed page
- Prefer concrete facts over abstract claims
- The ask must be specific enough that the reader knows exactly what to do

Return ONLY valid JSON.`;

  const result = await callClaude({
    system: systemPrompt,
    userMessage: `Generate a one-pager about: ${topic}`,
    model,
    maxTokens: 4096,
  });

  await logApiUsage({
    orgId: org_id,
    endpoint: 'generate_one_pager',
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  let content: OnePagerContent;
  try {
    // Strip markdown code fences if present
    let raw = result.text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    content = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse AI response', raw: result.text },
      { status: 500 }
    );
  }

  // Build markdown draft for preview
  const markdownDraft = buildMarkdownDraft(content);

  // Generate .docx
  const org = ctx.org;
  let logoBuffer: Buffer | undefined;
  if (org?.branding?.logo_url) {
    try {
      const { data: logoData } = await supabaseAdmin.storage
        .from('intel')
        .download(org.branding.logo_url);
      if (logoData) {
        logoBuffer = Buffer.from(await logoData.arrayBuffer());
      }
    } catch {
      // Skip logo
    }
  }

  const docxBuffer = await generateOnePagerDocx(
    content,
    ctx.orgName,
    org?.branding,
    logoBuffer
  );

  // Insert record first to get id
  const { data: record, error: insertError } = await supabaseAdmin
    .from('intel_one_pagers')
    .insert({
      org_id,
      title: content.headline,
      topic,
      audience,
      content,
      markdown_draft: markdownDraft,
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError || !record) {
    return NextResponse.json(
      { error: 'Failed to save one-pager' },
      { status: 500 }
    );
  }

  // Upload .docx
  const storagePath = `intel/${org_id}/one-pagers/${record.id}.docx`;
  await supabaseAdmin.storage
    .from('intel')
    .upload(storagePath, docxBuffer, {
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });

  // Update record with storage path
  await supabaseAdmin
    .from('intel_one_pagers')
    .update({ docx_storage_path: storagePath })
    .eq('id', record.id);

  return NextResponse.json(
    { ...record, docx_storage_path: storagePath },
    { status: 201 }
  );
}

function buildMarkdownDraft(content: OnePagerContent): string {
  const lines = [
    `# ${content.headline}`,
    `*${content.subheadline}*`,
    '',
    '## THE ISSUE',
    content.the_issue,
    '',
    '## OUR POSITION',
    content.our_position,
    '',
    '## KEY POINTS',
    ...content.key_points.map((p) => `- ${p}`),
    '',
  ];

  if (content.pullout_stat?.number) {
    lines.push(
      `> **${content.pullout_stat.number}** — ${content.pullout_stat.context}`
    );
    lines.push('');
  }

  lines.push('## THE ASK');
  lines.push(`**${content.the_ask}**`);
  lines.push('');

  if (content.contact?.name) {
    const parts = [content.contact.name];
    if (content.contact.title) parts.push(content.contact.title);
    if (content.contact.email) parts.push(content.contact.email);
    if (content.contact.phone) parts.push(content.contact.phone);
    lines.push(`---`);
    lines.push(parts.join(' | '));
  }

  return lines.join('\n');
}
