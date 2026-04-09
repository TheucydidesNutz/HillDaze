import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import { extractText, getDocumentProxy } from 'unpdf';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { chunkText } from '@/lib/analysis/chunking';
import { generateEmbeddings } from '@/lib/analysis/embeddings';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const orgId = formData.get('org_id') as string;
  const folder = (formData.get('folder') as string) || 'General';

  if (!file || !orgId) {
    return NextResponse.json({ error: 'file and org_id are required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(orgId, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Validate file type
  const fileExtension = file.name.toLowerCase().split('.').pop() || '';
  const allowedExtensions = ['pdf', 'doc', 'docx', 'txt'];
  if (!allowedExtensions.includes(fileExtension)) {
    return NextResponse.json({ error: 'Unsupported file type. Upload PDF, Word (.docx/.doc), or text (.txt) files.' }, { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 50MB' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract text
  let extractedText = '';

  if (fileExtension === 'pdf') {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      extractedText = text;
      pdf.cleanup();
    } catch (err) {
      console.error('[workspace-upload] PDF parse failed:', err);
      return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 400 });
    }
  } else if (fileExtension === 'docx' || fileExtension === 'doc') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } catch (err) {
      console.error('[workspace-upload] DOCX parse failed:', err);
      return NextResponse.json({ error: 'Failed to parse document' }, { status: 400 });
    }
  } else if (fileExtension === 'txt') {
    extractedText = new TextDecoder('utf-8').decode(buffer);
  }

  // Upload to Supabase Storage
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `workspaces/${workspace.id}/documents/${timestamp}_${safeName}`;

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
  const textForSummary = extractedText.substring(0, 100000);
  const model = 'claude-sonnet-4-20250514';
  let summaryData: { title?: string; summary?: string; key_topics?: string[] } = {};

  try {
    const result = await callClaude({
      system: `You are a document analyst for a workspace called "${workspace.name}". ${workspace.description || ''} Analyze the uploaded document and produce a structured JSON summary. Return ONLY valid JSON.`,
      userMessage: `Analyze this document and return a JSON object:
{
  "title": "document title (extracted or inferred)",
  "summary": "2-4 sentence summary of the document's key content",
  "key_topics": ["topic1", "topic2", "topic3"]
}

Document text:
${textForSummary}`,
      model,
      maxTokens: 2048,
    });

    await logApiUsage({
      orgId,
      endpoint: 'workspace_document_summarize',
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    try {
      summaryData = JSON.parse(result.text);
    } catch {
      summaryData = { title: file.name, summary: result.text, key_topics: [] };
    }
  } catch (err) {
    console.error('[workspace-upload] summarization failed:', err);
    summaryData = { title: file.name, summary: 'Summarization failed.', key_topics: [] };
  }

  // Insert workspace_documents record
  const { data: doc, error: insertError } = await supabaseAdmin
    .from('workspace_documents')
    .insert({
      workspace_id: workspace.id,
      title: summaryData.title || file.name,
      source_type: 'upload',
      content: extractedText,
      summary: summaryData.summary || null,
      metadata: { key_topics: summaryData.key_topics || [] },
      folder,
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[workspace-upload] insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 });
  }

  // Chunk and embed (fire-and-forget)
  chunkAndEmbed(workspace.id, doc.id, extractedText).catch(err => {
    console.error('[workspace-upload] chunking/embedding error:', err);
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}

async function chunkAndEmbed(workspaceId: string, documentId: string, text: string) {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  const texts = chunks.map(c => c.text);
  const embeddings = await generateEmbeddings(texts);

  // Bulk insert chunks with embeddings
  const rows = chunks.map((chunk, i) => ({
    document_id: documentId,
    workspace_id: workspaceId,
    chunk_text: chunk.text,
    chunk_index: chunk.index,
    embedding: JSON.stringify(embeddings[i]),
  }));

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabaseAdmin
      .from('workspace_chunks')
      .insert(batch);

    if (error) {
      console.error('[workspace-upload] chunk insert error:', error.message);
    }
  }
}
