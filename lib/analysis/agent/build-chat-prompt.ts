import { supabaseAdmin } from '@/lib/supabase';
import type { AnalysisProfile } from '../types';
import type { SoulDocumentContent } from './generate-soul-document';

export async function buildAnalysisChatPrompt(
  profile: AnalysisProfile,
  orgId: string,
  orgName: string,
  userMessage: string,
  focusedInputFolderId?: string | null,
  focusedOutputFolderId?: string | null
): Promise<{ systemPrompt: string; relevantItemIds: string[] }> {
  // Layer 1: Base instructions
  const baseInstructions = `You are a research analyst for ${orgName}. Your role is to help users understand ${profile.full_name} and communicate with/for them effectively.

CRITICAL RULES:
- Every factual claim MUST cite a specific data item by ID using [SOURCE:item-id] format
- NEVER invent quotes, positions, or facts not in your context
- If you don't have enough data to answer, say so explicitly
- Distinguish between '${profile.full_name} has said X' (direct quote with citation) and '${profile.full_name}'s pattern suggests X' (inference from multiple sources, cite them)
- When generating content 'in the style of' someone, base it ONLY on documented patterns from the source material, not assumptions
- Always use [SOURCE:item-id] citations inline in your response — these will be rendered as clickable footnotes for the user`;

  // Layer 2: Soul Document
  const { data: soulDoc } = await supabaseAdmin
    .from('analysis_soul_documents')
    .select('content')
    .eq('profile_id', profile.id)
    .single();

  const soulContent = soulDoc?.content as SoulDocumentContent | null;
  const soulSection = soulContent
    ? `\n\nSOUL DOCUMENT (comprehensive profile of ${profile.full_name}):\n${JSON.stringify(soulContent, null, 1)}`
    : `\n\nSOUL DOCUMENT: Not yet generated. Use only the raw data items below.`;

  // Layer 3: Relevant data items — get top items most relevant to the user query
  // Use a simple keyword match + recent items approach
  const keywords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  // Get verified items, prioritizing trusted sources and recent items
  const { data: allItems } = await supabaseAdmin
    .from('analysis_data_items')
    .select('id, category, title, summary, key_quotes, key_topics, source_url, source_name, source_trust_level, item_date, tone_analysis')
    .eq('profile_id', profile.id)
    .eq('verification_status', 'verified')
    .order('source_trust_level', { ascending: true }) // trusted first
    .order('item_date', { ascending: false, nullsFirst: false })
    .limit(100);

  const items = allItems || [];

  // Score items by keyword relevance
  const scored = items.map(item => {
    let score = 0;
    const text = `${item.title || ''} ${item.summary || ''} ${(item.key_topics || []).join(' ')}`.toLowerCase();
    for (const kw of keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (item.source_trust_level === 'trusted') score += 0.5;
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topItems = scored.slice(0, 25);
  const relevantItemIds = topItems.map(s => s.item.id);

  const itemsSection = topItems.length > 0
    ? `\n\nRELEVANT DATA ITEMS (cite these using [SOURCE:item-id]):\n` +
      topItems.map(({ item }) =>
        `[ITEM:${item.id}] ${item.category}${item.source_trust_level === 'trusted' ? ' [TRUSTED]' : ''} | ${item.item_date || 'undated'} | ${item.source_name || 'unknown'}
Title: ${item.title || 'Untitled'}
Summary: ${(item.summary || '').substring(0, 500)}
${item.key_quotes && item.key_quotes.length > 0 ? 'Direct Quotes: ' + item.key_quotes.slice(0, 3).map((q: string) => `"${q}"`).join('; ') : ''}
Source URL: ${item.source_url || 'N/A'}`
      ).join('\n---\n')
    : '\n\nNO DATA ITEMS AVAILABLE — Inform the user that no verified data has been collected yet.';

  // Layer 4: Focused folder content
  let focusedSection = '';

  if (focusedInputFolderId) {
    // Load ALL items in the input folder with FULL TEXT
    const { data: folderItems } = await supabaseAdmin
      .from('analysis_focused_folder_items')
      .select('data_item_id')
      .eq('folder_id', focusedInputFolderId);

    if (folderItems && folderItems.length > 0) {
      const itemIds = folderItems.filter(fi => fi.data_item_id).map(fi => fi.data_item_id);
      const { data: fullItems } = await supabaseAdmin
        .from('analysis_data_items')
        .select('id, title, full_text, summary, key_quotes, source_url, source_name, item_date, category')
        .in('id', itemIds);

      if (fullItems && fullItems.length > 0) {
        focusedSection += '\n\nFOCUSED INPUT: The user has highlighted these specific documents for deep analysis. Use them as primary source material:\n' +
          fullItems.map(item =>
            `[ITEM:${item.id}] "${item.title || 'Untitled'}" (${item.category}, ${item.item_date || 'undated'})\n` +
            `Source: ${item.source_name || 'unknown'} — ${item.source_url || 'N/A'}\n` +
            `Full Text:\n${item.full_text || item.summary || 'No text available'}`
          ).join('\n\n===\n\n');
      }
    }
  }

  if (focusedOutputFolderId) {
    const { data: folderItems } = await supabaseAdmin
      .from('analysis_focused_folder_items')
      .select('data_item_id')
      .eq('folder_id', focusedOutputFolderId);

    if (folderItems && folderItems.length > 0) {
      const itemIds = folderItems.filter(fi => fi.data_item_id).map(fi => fi.data_item_id);
      const { data: fullItems } = await supabaseAdmin
        .from('analysis_data_items')
        .select('id, title, full_text, summary, source_name, category')
        .in('id', itemIds);

      if (fullItems && fullItems.length > 0) {
        focusedSection += '\n\nFOCUSED OUTPUT REFERENCE: The user wants output styled after these examples. Match the structure, tone, formatting, and approach:\n' +
          fullItems.map(item =>
            `[REFERENCE:${item.id}] "${item.title || 'Untitled'}" (${item.category})\n` +
            `${item.full_text || item.summary || 'No text available'}`
          ).join('\n\n===\n\n');
      }
    }
  }

  const systemPrompt = baseInstructions + soulSection + itemsSection + focusedSection;

  return { systemPrompt, relevantItemIds };
}

// Determine which model to use based on the user message
export function routeModel(message: string): { model: string; taskType: string } {
  const lower = message.toLowerCase();

  // Content generation patterns → Opus
  const generationPatterns = [
    /\b(write|draft|compose|create|generate)\b.*\b(speech|letter|brief|tweet|email|memo|op-ed|testimony|statement|talking.?points|press.?release)\b/,
    /\b(speech|letter|brief|tweet|email|memo|op-ed|testimony)\b.*\b(write|draft|compose|create|generate)\b/,
  ];
  for (const p of generationPatterns) {
    if (p.test(lower)) return { model: 'claude-opus-4-20250514', taskType: 'content_generation' };
  }

  // Deep analysis patterns → Opus
  const analysisPatterns = [
    /\b(analyze|compare|contrast|deep.?dive|evolution|pattern|comprehensive)\b/,
  ];
  for (const p of analysisPatterns) {
    if (p.test(lower)) return { model: 'claude-opus-4-20250514', taskType: 'deep_analysis' };
  }

  // Research synthesis → Sonnet
  if (/\b(search|find|look.?up|research|what do we know)\b/.test(lower)) {
    return { model: 'claude-sonnet-4-20250514', taskType: 'research_synthesis' };
  }

  // Default → Sonnet
  return { model: 'claude-sonnet-4-20250514', taskType: 'chat_qa' };
}
