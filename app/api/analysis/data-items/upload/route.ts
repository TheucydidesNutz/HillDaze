import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { extractText, getDocumentProxy } from 'unpdf';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const profileId = formData.get('profile_id') as string;
  const orgId = formData.get('org_id') as string;
  const storageTier = (formData.get('storage_tier') as string) || 'deep_dive';
  const folderPath = (formData.get('folder_path') as string) || '';

  if (!file || !profileId || !orgId) {
    return NextResponse.json({ error: 'file, profile_id, and org_id are required' }, { status: 400 });
  }

  // Validate membership
  const member = await getUserOrgMembership(orgId, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate profile belongs to org
  const { data: profile } = await supabaseAdmin
    .from('analysis_profiles')
    .select('id, org_id, full_name')
    .eq('id', profileId)
    .single();
  if (!profile || profile.org_id !== orgId) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Validate file type
  const fileExtension = file.name.toLowerCase().split('.').pop() || '';
  const allowedExtensions = ['pdf', 'doc', 'docx', 'txt'];
  if (!allowedExtensions.includes(fileExtension)) {
    return NextResponse.json({ error: 'Unsupported file type. Upload PDF, Word (.docx/.doc), or text (.txt) files.' }, { status: 400 });
  }

  // Validate file size (50MB)
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 50MB' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract text based on file type
  let extractedText = '';
  let pageCount = 0;

  if (fileExtension === 'pdf') {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      pageCount = pdf.numPages;
      const { text } = await extractText(pdf, { mergePages: true });
      extractedText = text;
      pdf.cleanup();
    } catch (parseErr) {
      console.error('[analysis-upload] PDF parse failed:', parseErr);
      return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 400 });
    }
  } else if (fileExtension === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
      pageCount = Math.ceil(extractedText.length / 3000);
    } catch (parseErr) {
      console.error('[analysis-upload] DOCX parse failed:', parseErr);
      return NextResponse.json({ error: 'Failed to parse Word document' }, { status: 400 });
    }
  } else if (fileExtension === 'doc') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } catch {
      extractedText = '[Text extraction not available for legacy .doc files. Please convert to .docx or .pdf for full analysis.]';
    }
    pageCount = Math.ceil(extractedText.length / 3000);
  } else if (fileExtension === 'txt') {
    extractedText = new TextDecoder('utf-8').decode(buffer);
    pageCount = Math.ceil(extractedText.length / 3000);
  }

  // Upload to Supabase Storage
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathPrefix = folderPath ? `${folderPath.replace(/\/+$/, '')}/` : '';
  const storagePath = `${orgId}/${profileId}/documents/${pathPrefix}${timestamp}_${safeName}`;

  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
  };

  const { error: uploadError } = await supabaseAdmin.storage
    .from('analysis')
    .upload(storagePath, buffer, {
      contentType: contentTypeMap[fileExtension] || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Storage upload failed: ' + uploadError.message }, { status: 500 });
  }

  // Summarize with Claude
  let summaryData: {
    title?: string;
    doc_type?: string;
    date?: string | null;
    author?: string | null;
    key_topics?: string[];
    executive_summary?: string;
    detailed_summary?: string;
    key_quotes?: { quote: string; context: string }[];
    tone_analysis?: Record<string, unknown>;
  } = {};

  const textForSummary = extractedText.substring(0, 100000);
  const model = 'claude-sonnet-4-20250514';

  try {
    const result = await callClaude({
      system: `You are a document analyst for Covaled Analysis, a person-profiling intelligence platform. You are analyzing a document related to the public figure "${profile.full_name}". Analyze the document and produce a structured JSON summary. Return ONLY valid JSON, no markdown formatting or code blocks.`,
      userMessage: `Analyze this document and return a JSON object with these fields:
{
  "title": "document title (extracted or inferred)",
  "doc_type": "speech|legislation|legal_filing|policy_paper|news_article|interview|report|position_paper|other",
  "date": "publication/speech date if found, or null",
  "author": "author if found, or null",
  "key_topics": ["topic1", "topic2", "topic3"],
  "executive_summary": "2-3 sentence summary focusing on ${profile.full_name}'s positions, actions, or statements",
  "detailed_summary": "1-2 paragraph structured summary of key points relevant to understanding this person",
  "key_quotes": [{"quote": "exact direct quote from the text", "context": "why this quote matters for understanding this person"}],
  "tone_analysis": {
    "formality": "formal|informal|mixed",
    "aggression": "aggressive|measured|conciliatory",
    "confidence": "high|moderate|low",
    "partisanship": "highly_partisan|moderate|bipartisan|nonpartisan",
    "notes": "brief description of rhetorical style"
  }
}

IMPORTANT: Every quote in key_quotes must be an exact, verbatim quote from the document text. Do NOT paraphrase or synthesize quotes.

Document text:
${textForSummary}`,
      model,
      maxTokens: 4096,
    });

    await logApiUsage({
      orgId,
      endpoint: 'analysis_document_summarize',
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    try {
      summaryData = JSON.parse(result.text);
    } catch {
      summaryData = {
        title: file.name,
        executive_summary: result.text,
        key_topics: [],
      };
    }
  } catch (err) {
    console.error('[analysis-upload] summarization failed:', err);
    summaryData = {
      title: file.name,
      executive_summary: 'Summarization failed. Full text is available for manual review.',
      key_topics: [],
    };
  }

  // Create analysis_data_items record
  const { data: dataItem, error: insertError } = await supabaseAdmin
    .from('analysis_data_items')
    .insert({
      profile_id: profileId,
      org_id: orgId,
      category: 'uploaded_doc',
      subcategory: summaryData.doc_type || null,
      title: summaryData.title || file.name,
      full_text: storageTier === 'deep_dive' ? extractedText : null,
      summary: [summaryData.executive_summary, summaryData.detailed_summary].filter(Boolean).join('\n\n'),
      key_quotes: (summaryData.key_quotes || []).map(q => q.quote),
      key_topics: summaryData.key_topics || [],
      source_url: null,
      source_name: 'user_upload',
      source_trust_level: 'trusted',
      item_date: summaryData.date || null,
      venue: null,
      context: null,
      tone_analysis: summaryData.tone_analysis || {},
      folder_path: folderPath || null,
      storage_path: storagePath,
      storage_tier: storageTier,
      original_filename: file.name,
      file_size_bytes: file.size,
      verification_status: 'verified',
      anomaly_flags: {},
    })
    .select()
    .single();

  if (insertError) {
    console.error('[analysis-upload] insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to create data item record' }, { status: 500 });
  }

  // Trigger folder analyses at each level of the path hierarchy (fire-and-forget)
  if (folderPath) {
    triggerFolderAnalyses(profileId, orgId, folderPath, profile.full_name).catch(err => {
      console.error('[analysis-upload] folder analysis error:', err);
    });
  }

  return NextResponse.json({
    ...dataItem,
    summary_metadata: summaryData,
  }, { status: 201 });
}

// Generate analyses for each level of the folder path hierarchy
async function triggerFolderAnalyses(profileId: string, orgId: string, folderPath: string, profileName: string) {
  const parts = folderPath.replace(/\/+$/, '').split('/').filter(Boolean);
  const folderPaths: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    folderPaths.push(parts.slice(0, i).join('/'));
  }

  for (const fp of folderPaths) {
    try {
      // Get all items in this folder path (exact match or starts with)
      const { data: items } = await supabaseAdmin
        .from('analysis_data_items')
        .select('id, title, summary, key_topics, tone_analysis, item_date, category')
        .eq('profile_id', profileId)
        .eq('org_id', orgId)
        .like('folder_path', `${fp}%`)
        .order('item_date', { ascending: true, nullsFirst: false });

      if (!items || items.length < 1) continue;

      const itemSummaries = items.map(item =>
        `- "${item.title}" (${item.item_date || 'undated'}, ${item.category}): ${item.summary?.substring(0, 300) || 'No summary'}`
      ).join('\n');

      const model = 'claude-sonnet-4-20250514';
      const result = await callClaude({
        system: `You are analyzing a collection of documents about ${profileName} in the folder "${fp}". Return ONLY valid JSON.`,
        userMessage: `Analyze these ${items.length} documents and return a JSON object:
{
  "theme_summary": "2-3 sentence overview of what this collection reveals about ${profileName}",
  "common_topics": ["topic1", "topic2"],
  "tone_patterns": "description of overall tone/rhetoric patterns across documents",
  "position_evolution": "how ${profileName}'s positions appear to evolve across these documents (if chronological data available)",
  "contradictions": "any contradictions or inconsistencies found across documents, or 'None detected'",
  "key_insights": ["insight1", "insight2"]
}

Documents in "${fp}":
${itemSummaries}`,
        model,
        maxTokens: 2048,
      });

      await logApiUsage({
        orgId,
        endpoint: 'analysis_folder_analysis',
        model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      let analysis: Record<string, unknown> = {};
      try {
        analysis = JSON.parse(result.text);
      } catch {
        analysis = { theme_summary: result.text };
      }

      // Upsert folder analysis
      const { data: existing } = await supabaseAdmin
        .from('analysis_folder_analyses')
        .select('id')
        .eq('profile_id', profileId)
        .eq('org_id', orgId)
        .eq('folder_path', fp)
        .single();

      if (existing) {
        await supabaseAdmin
          .from('analysis_folder_analyses')
          .update({
            analysis,
            item_count: items.length,
            last_regenerated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('analysis_folder_analyses')
          .insert({
            profile_id: profileId,
            org_id: orgId,
            folder_path: fp,
            analysis,
            item_count: items.length,
            last_regenerated_at: new Date().toISOString(),
          });
      }
    } catch (err) {
      console.error(`[analysis-upload] folder analysis for "${fp}" failed:`, err);
    }
  }
}
