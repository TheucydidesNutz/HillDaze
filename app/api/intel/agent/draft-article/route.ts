import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership, getLatestSoulDocument } from '@/lib/intel/supabase-queries';
import { getAnthropicClient } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { getDraftArticleSystemPrompt } from '@/lib/intel/agent/prompts/draft-article';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { recommendation_id } = await request.json();

  const { data: rec } = await supabaseAdmin
    .from('intel_article_recommendations')
    .select('*')
    .eq('id', recommendation_id)
    .single();

  if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });

  const member = await getUserOrgMembership(rec.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Update status to draft_requested
  await supabaseAdmin.from('intel_article_recommendations').update({ status: 'draft_requested' }).eq('id', recommendation_id);

  const soulDoc = await getLatestSoulDocument(rec.org_id);
  const toneSection = soulDoc?.content?.match(/## Tone & Voice[\s\S]*?(?=## |$)/)?.[0] || soulDoc?.content?.substring(0, 500) || '';

  const model = 'claude-opus-4-6';
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: getDraftArticleSystemPrompt({
      orgName: rec.org_id,
      toneSection,
      title: rec.title,
      thesis: rec.thesis,
      keyArguments: rec.key_arguments || [],
      articleType: rec.article_type,
    }),
    messages: [{ role: 'user', content: 'Write the complete draft.' }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const draft = textBlock?.text || '';

  await logApiUsage({
    orgId: rec.org_id,
    endpoint: 'draft_article',
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  await supabaseAdmin.from('intel_article_recommendations').update({
    status: 'draft_complete',
    draft_content: draft,
  }).eq('id', recommendation_id);

  return NextResponse.json({ draft, status: 'draft_complete' });
}
