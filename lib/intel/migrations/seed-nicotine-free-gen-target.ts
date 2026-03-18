/**
 * Seed research target "Nicotine-Free Generation Policies" for the cigar-rights org,
 * match existing news items, and generate an initial living summary.
 *
 * Run with: npx tsx lib/intel/migrations/seed-nicotine-free-gen-target.ts
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* env vars may already be set */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicKey = process.env.ANTHROPIC_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const searchTerms = [
  'nicotine free generation',
  'tobacco free generation',
  'generational tobacco ban',
  'generational smoking ban',
  'tobacco endgame',
  'lifetime tobacco ban',
  'born after tobacco ban',
  'tobacco purchase age cohort',
  'New Zealand tobacco ban',
  'Malaysia tobacco ban',
  'UK tobacco ban generation',
  'smokefree generation',
  'smoke-free generation',
  'tobacco 21 lifetime',
  'permanent tobacco prohibition',
  'tobacco phase out',
  'generational endgame',
];

async function main() {
  // 1. Get org
  const { data: org, error: orgError } = await supabase
    .from('intel_organizations')
    .select('id, name')
    .eq('slug', 'cigar-rights')
    .single();

  if (orgError || !org) {
    console.error('Could not find org with slug "cigar-rights":', orgError?.message);
    process.exit(1);
  }
  console.log(`Found org: ${org.name} (${org.id})`);

  // 2. Create research target
  const { data: target, error: targetError } = await supabase
    .from('intel_research_targets')
    .insert({
      org_id: org.id,
      name: 'Nicotine-Free Generation Policies',
      slug: 'nicotine-free-generation',
      icon: null,
      status: 'active',
      description: `Tracking the global and domestic spread of 'nicotine-free generation' or 'tobacco-free generation' policies — laws that permanently ban tobacco sales to anyone born after a certain year, creating a rolling age cohort that can never legally purchase tobacco products. Monitoring where these policies gain traction, where they stall or are repealed, and their implications for premium cigar exemptions.`,
      search_terms: searchTerms,
      tracking_brief: `Monitor all legislative, regulatory, and advocacy activity related to 'nicotine-free generation' or 'tobacco-free generation' policies worldwide and in the United States. These are laws that ban the sale of tobacco products to anyone born after a specified date, creating a permanent and expanding prohibition cohort.

KEY TRACKING PRIORITIES:

1. INTERNATIONAL PRECEDENTS: Track the status of existing generational bans — New Zealand (passed then repealed), Malaysia (implementation status), UK (Tobacco and Vapes Bill progress), and any new countries considering similar legislation. Note which have been successful, which have failed, and why.

2. U.S. STATE LEGISLATION: Flag any state legislature that introduces a generational tobacco ban bill. Track bill numbers, sponsors, committee assignments, hearing dates, and vote outcomes. As of 2025-2026, bills have been introduced in Massachusetts, Hawaii, and California — monitor these and any new states.

3. U.S. FEDERAL ACTIVITY: Track any federal legislation, FDA rulemaking, or Surgeon General statements that reference generational tobacco bans or tobacco endgame strategies.

4. PREMIUM CIGAR IMPLICATIONS: Critically assess whether any proposed generational ban includes or exempts premium cigars (as defined by the Mehta Definition). Most generational ban proposals are broadly worded and would include all tobacco products. Identify opportunities to advocate for premium cigar exemptions and flag language that could be amended.

5. ADVOCACY LANDSCAPE: Track which organizations are pushing for generational bans (Bloomberg Philanthropies, Campaign for Tobacco-Free Kids, ASH, WHO FCTC) and which are opposing them. Note coalition dynamics, funding sources, and messaging strategies on both sides.

6. PUBLIC OPINION & MEDIA: Monitor polling data on generational tobacco bans and media coverage framing. Note whether premium cigars are being conflated with cigarettes in the public discourse.

7. LEGAL CHALLENGES: Track any constitutional or legal challenges to generational bans — equal protection arguments, commerce clause issues, property rights claims. These precedents directly affect the viability of similar policies in the U.S.

8. REPEAL & ROLLBACK: Pay special attention to cases where generational bans are repealed, weakened, or fail to pass. New Zealand's repeal is the landmark example — document the political dynamics that led to reversal and assess whether similar dynamics exist elsewhere.

ANALYTICAL FRAMING: When the Intelligence Analyst discusses this topic, it should always distinguish between the policy's impact on cigarettes/vapes versus premium handmade cigars. The organization's position is that generational bans are blunt instruments that fail to distinguish between fundamentally different products and consumer demographics. Premium cigar consumers are overwhelmingly adults who take up cigar enjoyment later in life — a generational ban aimed at preventing youth initiation solves a problem that doesn't exist in the premium cigar market.`,
    })
    .select()
    .single();

  if (targetError || !target) {
    console.error('Failed to create research target:', targetError?.message);
    process.exit(1);
  }
  console.log(`Created research target: ${target.name} (${target.id})`);

  // 3. Match existing news items against search terms
  console.log('\nMatching existing news items against search terms...');

  const { data: newsItems } = await supabase
    .from('intel_news_items')
    .select('id, title, summary, raw_content')
    .eq('org_id', org.id);

  let matchCount = 0;
  const matchedIds: string[] = [];

  for (const item of newsItems || []) {
    const text = [item.title, item.summary, item.raw_content]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matched = searchTerms.some(term => text.includes(term.toLowerCase()));
    if (matched) {
      matchedIds.push(item.id);
      matchCount++;
    }
  }

  if (matchedIds.length > 0) {
    const rows = matchedIds.map(newsId => ({
      target_id: target.id,
      news_item_id: newsId,
      matched_at: new Date().toISOString(),
    }));

    const { error: linkError } = await supabase
      .from('intel_research_target_news')
      .insert(rows);

    if (linkError) {
      console.error('Failed to link news items:', linkError.message);
    } else {
      console.log(`Matched and linked ${matchCount} news items out of ${newsItems?.length || 0} total.`);
    }
  } else {
    console.log(`No matching news items found out of ${newsItems?.length || 0} total.`);
  }

  // 4. Generate initial living summary
  if (!anthropicKey) {
    console.log('\nNo ANTHROPIC_API_KEY found — skipping summary generation.');
    console.log('Done.');
    return;
  }

  console.log('\nGenerating initial living summary...');

  // Gather context
  const { data: soulDoc } = await supabase
    .from('intel_soul_documents')
    .select('content')
    .eq('org_id', org.id)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const { data: matchedNews } = await supabase
    .from('intel_research_target_news')
    .select('news_item:intel_news_items(*)')
    .eq('target_id', target.id)
    .order('matched_at', { ascending: false })
    .limit(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const news = (matchedNews || []).map((n: any) => n.news_item).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newsText = news.map((n: any) =>
    `- [${n.source_type}] "${n.title}": ${(n.summary || n.raw_content || '').substring(0, 200)}`
  ).join('\n') || 'No matched news items yet.';

  const client = new Anthropic({ apiKey: anthropicKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are a research analyst producing a structured intelligence brief on: "${target.name}".

Organization context:
${soulDoc?.content?.substring(0, 500) || 'No soul document.'}

Target description: ${target.description}
Tracking brief: ${target.tracking_brief || 'No specific tracking instructions.'}

Linked documents:
No linked documents yet.

Matched news items:
${newsText}

Related stakeholders:
No linked stakeholders yet.

This is the first summary — create a comprehensive initial brief based on your knowledge.

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
    messages: [{ role: 'user', content: 'Generate the research brief now.' }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const summaryContent = textBlock?.text || '';

  if (!summaryContent) {
    console.error('Claude returned empty response');
    console.log('Done (no summary generated).');
    return;
  }

  const { data: summary, error: summaryError } = await supabase
    .from('intel_research_target_summaries')
    .insert({
      target_id: target.id,
      org_id: org.id,
      version: 1,
      content: summaryContent,
      doc_count: 0,
      news_count: news.length,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (summaryError) {
    console.error('Failed to save summary:', summaryError.message);
  } else {
    console.log(`Generated initial summary (v1, ${summaryContent.length} chars)`);
    console.log(`  Input tokens: ${response.usage.input_tokens}, Output tokens: ${response.usage.output_tokens}`);
  }

  // Log API usage
  await supabase.from('intel_api_usage').insert({
    org_id: org.id,
    endpoint: 'research_summary',
    model: 'claude-sonnet-4-20250514',
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    estimated_cost: response.usage.input_tokens * 0.000003 + response.usage.output_tokens * 0.000015,
  });

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
