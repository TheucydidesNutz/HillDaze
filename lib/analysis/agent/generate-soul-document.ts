import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { supabaseAdmin } from '@/lib/supabase';
import type { AnalysisProfile, AnalysisSoulDocument } from '../types';

export interface SoulDocumentContent {
  meta: {
    person_name: string;
    title: string | null;
    party: string | null;
    last_updated: string;
    data_item_count: number;
    confidence_level: 'low' | 'medium' | 'high';
  };
  communication_style: {
    overall_tone: string;
    vocabulary_level: string;
    rhetorical_devices: string[];
    sentence_patterns: string;
    humor_style: string;
    signature_phrases: string[];
    differences_by_medium: Record<string, string>;
    source_citations: string[];
  };
  priorities: {
    top_issues: Array<{
      topic: string;
      position: string;
      intensity: 'high' | 'medium' | 'low';
      evolution: string;
      key_quotes: Array<{ quote: string; source_item_id: string }>;
    }>;
    secondary_issues: string[];
    known_opposition: string[];
    source_citations: string[];
  };
  voting_pattern_summary: {
    party_alignment_pct: string;
    breakaway_areas: string[];
    bipartisan_collaborations: string[];
    source_citations: string[];
  };
  personal_touchstones: {
    background: string;
    education: string;
    family_references: string[];
    hobbies_interests: string[];
    source_citations: string[];
  };
  donation_network_summary: {
    top_donors_by_sector: string[];
    top_recipients: string[];
    pac_affiliations: string[];
    source_citations: string[];
  };
  media_presence: {
    preferred_outlets: string[];
    podcast_appearances: string[];
    social_media_habits: Record<string, string>;
    source_citations: string[];
  };
  how_to_communicate_with_them: {
    dos: string[];
    donts: string[];
    best_approach_by_context: Record<string, string>;
    source_citations: string[];
  };
}

export async function generateSoulDocument(
  profile: AnalysisProfile,
  orgId: string
): Promise<SoulDocumentContent> {
  // Get all verified data items
  const { data: items } = await supabaseAdmin
    .from('analysis_data_items')
    .select('id, category, subcategory, title, summary, key_quotes, key_topics, source_url, source_name, item_date, tone_analysis, verification_status')
    .eq('profile_id', profile.id)
    .eq('verification_status', 'verified')
    .order('item_date', { ascending: false, nullsFirst: false })
    .limit(500);

  const verifiedItems = items || [];
  const itemCount = verifiedItems.length;
  const confidenceLevel = itemCount < 50 ? 'low' : itemCount < 200 ? 'medium' : 'high';

  // Build context string with item IDs so Claude can cite them
  const itemContext = verifiedItems.slice(0, 200).map(item =>
    `[ITEM:${item.id}] (${item.category}${item.subcategory ? '/' + item.subcategory : ''}, ${item.item_date || 'undated'}, source: ${item.source_name || 'unknown'})
Title: ${item.title || 'Untitled'}
Summary: ${(item.summary || '').substring(0, 400)}
${item.key_quotes && item.key_quotes.length > 0 ? 'Quotes: ' + item.key_quotes.slice(0, 3).map((q: string) => `"${q}"`).join('; ') : ''}
Topics: ${(item.key_topics || []).join(', ')}
${item.tone_analysis && Object.keys(item.tone_analysis).length > 0 ? 'Tone: ' + JSON.stringify(item.tone_analysis) : ''}`
  ).join('\n---\n');

  const model = 'claude-sonnet-4-20250514';

  const result = await callClaude({
    system: `You are building a comprehensive "soul document" — a structured intelligence dossier about a public figure. You are analyzing ${itemCount} verified data items about ${profile.full_name}.

CRITICAL RULES:
- Every section MUST include source_citations[] containing the ITEM IDs (e.g., "abc-123-def") of the specific data items that support that section.
- NEVER invent information. If data is insufficient for a section, write "Insufficient data" for string fields and empty arrays for array fields.
- Every quote in key_quotes MUST be an exact quote from the data items, with the source_item_id of the item it came from.
- Distinguish between direct quotes and inferred patterns.
- Return ONLY valid JSON, no markdown or code blocks.`,
    userMessage: `Generate a soul document JSON for ${profile.full_name} (${profile.position_type.replace('_', ' ')}${profile.party ? ', ' + profile.party : ''}${profile.state ? ', ' + profile.state : ''}).

Return this exact JSON structure:
{
  "meta": {
    "person_name": "${profile.full_name}",
    "title": "${profile.title || ''}",
    "party": "${profile.party || ''}",
    "last_updated": "${new Date().toISOString()}",
    "data_item_count": ${itemCount},
    "confidence_level": "${confidenceLevel}"
  },
  "communication_style": {
    "overall_tone": "description",
    "vocabulary_level": "description",
    "rhetorical_devices": ["device1"],
    "sentence_patterns": "description",
    "humor_style": "description",
    "signature_phrases": ["phrase1"],
    "differences_by_medium": {"floor_speech": "...", "social_media": "...", "press_conference": "..."},
    "source_citations": ["item-id-1"]
  },
  "priorities": {
    "top_issues": [{"topic": "...", "position": "...", "intensity": "high|medium|low", "evolution": "...", "key_quotes": [{"quote": "exact quote", "source_item_id": "item-id"}]}],
    "secondary_issues": ["issue1"],
    "known_opposition": ["opposition1"],
    "source_citations": ["item-id-1"]
  },
  "voting_pattern_summary": {
    "party_alignment_pct": "X%",
    "breakaway_areas": ["area1"],
    "bipartisan_collaborations": ["collab1"],
    "source_citations": ["item-id-1"]
  },
  "personal_touchstones": {
    "background": "...",
    "education": "...",
    "family_references": ["ref1"],
    "hobbies_interests": ["hobby1"],
    "source_citations": ["item-id-1"]
  },
  "donation_network_summary": {
    "top_donors_by_sector": ["sector1"],
    "top_recipients": ["recipient1"],
    "pac_affiliations": ["pac1"],
    "source_citations": ["item-id-1"]
  },
  "media_presence": {
    "preferred_outlets": ["outlet1"],
    "podcast_appearances": ["appearance1"],
    "social_media_habits": {"twitter": "...", "instagram": "..."},
    "source_citations": ["item-id-1"]
  },
  "how_to_communicate_with_them": {
    "dos": ["do1"],
    "donts": ["dont1"],
    "best_approach_by_context": {"requesting_meeting": "...", "seeking_cosponsorship": "...", "persuasion": "..."},
    "source_citations": ["item-id-1"]
  }
}

DATA ITEMS:
${itemContext}`,
    model,
    maxTokens: 8192,
  });

  await logApiUsage({
    orgId,
    endpoint: 'analysis_soul_document_generation',
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  let content: SoulDocumentContent;
  try {
    let jsonText = result.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    content = JSON.parse(jsonText);
  } catch {
    // Return a minimal valid structure
    content = {
      meta: {
        person_name: profile.full_name,
        title: profile.title,
        party: profile.party,
        last_updated: new Date().toISOString(),
        data_item_count: itemCount,
        confidence_level: confidenceLevel,
      },
      communication_style: { overall_tone: 'Insufficient data', vocabulary_level: '', rhetorical_devices: [], sentence_patterns: '', humor_style: '', signature_phrases: [], differences_by_medium: {}, source_citations: [] },
      priorities: { top_issues: [], secondary_issues: [], known_opposition: [], source_citations: [] },
      voting_pattern_summary: { party_alignment_pct: 'Insufficient data', breakaway_areas: [], bipartisan_collaborations: [], source_citations: [] },
      personal_touchstones: { background: 'Insufficient data', education: '', family_references: [], hobbies_interests: [], source_citations: [] },
      donation_network_summary: { top_donors_by_sector: [], top_recipients: [], pac_affiliations: [], source_citations: [] },
      media_presence: { preferred_outlets: [], podcast_appearances: [], social_media_habits: {}, source_citations: [] },
      how_to_communicate_with_them: { dos: [], donts: [], best_approach_by_context: {}, source_citations: [] },
    };
  }

  // Update soul document in DB
  const { data: existing } = await supabaseAdmin
    .from('analysis_soul_documents')
    .select('id, version')
    .eq('profile_id', profile.id)
    .single();

  if (existing) {
    await supabaseAdmin
      .from('analysis_soul_documents')
      .update({
        content,
        version: existing.version + 1,
        last_regenerated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin
      .from('analysis_soul_documents')
      .insert({
        profile_id: profile.id,
        org_id: orgId,
        content,
        version: 1,
        last_regenerated_at: new Date().toISOString(),
      });
  }

  return content;
}
