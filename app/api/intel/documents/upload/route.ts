import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import {
  getUserOrgMembership,
  getOrgById,
  getLatestSoulDocument,
  createDocument,
  updateDocumentSummary,
  logActivity,
} from '@/lib/intel/supabase-queries';
import { summarizeDocument } from '@/lib/intel/agent/summarize';
import { extractText, getDocumentProxy } from 'unpdf';

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
  const folder = formData.get('folder') as 'deep_dive' | 'reference';
  const orgId = formData.get('org_id') as string;
  const folderIdRaw = formData.get('folder_id');
  const folderId = typeof folderIdRaw === 'string' && folderIdRaw.length > 0 ? folderIdRaw : null;

  console.log('[upload] folder_id from formData:', JSON.stringify(folderIdRaw), '-> resolved:', folderId);

  if (!file || !folder || !orgId) {
    console.error('[upload] 400: missing required fields — file:', !!file, 'folder:', folder, 'org_id:', orgId);
    return NextResponse.json({ error: 'file, folder, and org_id are required' }, { status: 400 });
  }

  // If folder_id provided, walk up the tree to determine root behavior and build storage path
  let effectiveFolder = folder;
  let folderSlugPath: string = folder;
  if (folderId) {
    // Walk up the full ancestry to find the root folder type and build slug path
    const slugParts: string[] = [];
    let walkId: string | null = folderId;
    let rootType: string | null = null;

    while (walkId) {
      const result = await supabaseAdmin
        .from('intel_document_folders')
        .select('slug, parent_id, folder_type')
        .eq('id', walkId)
        .single();
      const ancestor = result.data as { slug: string; parent_id: string | null; folder_type: string } | null;
      if (!ancestor) break;
      slugParts.unshift(ancestor.slug);
      if (!ancestor.parent_id) {
        // This is the root — its type determines behavior
        rootType = ancestor.folder_type;
        break;
      }
      walkId = ancestor.parent_id;
    }

    if (rootType === 'reference') {
      effectiveFolder = 'reference';
    } else {
      effectiveFolder = 'deep_dive';
    }
    if (slugParts.length > 0) {
      folderSlugPath = slugParts.join('/');
    }
  }

  // Validate membership
  const member = await getUserOrgMembership(orgId, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  const fileExtension = file.name.toLowerCase().split('.').pop() || '';
  const allowedExtensions = ['pdf', 'doc', 'docx', 'txt'];

  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    console.error('[upload] 400: unsupported file type:', file.type, 'ext:', fileExtension, 'name:', file.name);
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
      console.error('[upload] 400: PDF parse failed:', parseErr);
      return NextResponse.json({ error: 'Failed to parse document' }, { status: 400 });
    }
  } else if (fileExtension === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
      pageCount = Math.ceil(extractedText.length / 3000);
    } catch (parseErr) {
      console.error('[upload] 400: DOCX parse failed:', parseErr);
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
  } else {
    return NextResponse.json({ error: 'Unsupported file type. Upload PDF, Word (.docx/.doc), or text (.txt) files.' }, { status: 400 });
  }

  // Upload to Supabase Storage
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `intel/${orgId}/documents/${folderSlugPath}/original/${timestamp}_${safeName}`;

  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
  };

  const { error: uploadError } = await supabaseAdmin.storage
    .from('intel')
    .upload(storagePath, buffer, {
      contentType: contentTypeMap[fileExtension] || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Storage upload failed: ' + uploadError.message }, { status: 500 });
  }

  // Create database row
  console.log('[upload] creating document with folder_id:', folderId, 'effectiveFolder:', effectiveFolder);
  const doc = await createDocument({
    org_id: orgId,
    folder: effectiveFolder,
    filename: file.name,
    storage_path: storagePath,
    full_text: effectiveFolder === 'deep_dive' ? extractedText : null,
    uploaded_by: user.id,
    summary_metadata: { page_count: pageCount, file_type: fileExtension },
    folder_id: folderId || undefined,
  });

  if (!doc) {
    return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 });
  }

  // Log activity
  await logActivity({
    org_id: orgId,
    user_id: user.id,
    action_type: 'document_upload',
    action_detail: { document_id: doc.id, filename: file.name, folder },
  });

  // Summarize with Claude (sync — may take 10-30s)
  try {
    const org = await getOrgById(orgId);
    const soulDoc = await getLatestSoulDocument(orgId);
    const focusAreas = soulDoc?.content?.substring(0, 1000) || 'No focus areas defined yet.';

    const summaryJson = await summarizeDocument({
      extractedText,
      filename: file.name,
      orgId,
      orgName: org?.name || 'Organization',
      focusAreas,
    });

    const summaryText = [summaryJson.executive_summary, summaryJson.detailed_summary]
      .filter(Boolean)
      .join('\n\n');

    await updateDocumentSummary(doc.id, summaryText, { ...summaryJson, page_count: pageCount, file_type: fileExtension });

    // Store summary JSON in storage
    const summaryPath = `intel/${orgId}/documents/${folderSlugPath}/summaries/${safeName}.json`;
    await supabaseAdmin.storage
      .from('intel')
      .upload(summaryPath, JSON.stringify(summaryJson, null, 2), {
        contentType: 'application/json',
        upsert: true,
      });

    return NextResponse.json({ ...doc, summary: summaryText, summary_metadata: { ...summaryJson, page_count: pageCount, file_type: fileExtension } }, { status: 201 });
  } catch (err) {
    // Return the doc even if summarization fails
    return NextResponse.json(doc, { status: 201 });
  }
}
