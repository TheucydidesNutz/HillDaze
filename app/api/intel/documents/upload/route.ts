import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import {
  getUserOrgMembership,
  getOrgById,
  getLatestSoulDocument,
  createDocument,
  updateDocumentSummary,
  logActivity,
  checkExactDuplicate,
  checkNearDuplicates,
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

  // Check for force-upload flag (bypasses exact duplicate blocking)
  const forceUpload = formData.get('force') === 'true';

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Layer 1: Generate SHA-256 hash for exact duplicate detection
  const fileHash = createHash('sha256').update(buffer).digest('hex');

  if (!forceUpload) {
    const existingDoc = await checkExactDuplicate(orgId, fileHash);
    if (existingDoc) {
      // Look up folder name for the existing duplicate
      let folderName = '';
      if (existingDoc.folder_id) {
        const { data: folder } = await supabaseAdmin
          .from('intel_document_folders')
          .select('name')
          .eq('id', existingDoc.folder_id)
          .single();
        folderName = folder?.name || '';
      }

      return NextResponse.json({
        error: 'exact_duplicate',
        message: `This exact file has already been uploaded as "${existingDoc.filename}"${folderName ? ` in the ${folderName} folder` : ''} on ${new Date(existingDoc.uploaded_at).toLocaleDateString()}.`,
        duplicate: {
          id: existingDoc.id,
          filename: existingDoc.filename,
          folder_name: folderName,
          uploaded_at: existingDoc.uploaded_at,
        },
      }, { status: 409 });
    }
  }

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
    file_hash: fileHash,
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

  // Layer 2: Near-duplicate detection using pg_trgm on extracted text
  let nearDuplicates: { id: string; filename: string; folder_id: string | null; similarity: number }[] = [];
  if (extractedText && extractedText.length > 50) {
    try {
      nearDuplicates = (await checkNearDuplicates(orgId, extractedText))
        .filter(d => d.id !== doc.id); // exclude self
    } catch (err) {
      console.error('[upload] near-duplicate check failed (non-blocking):', err);
    }
  }

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

    // If near-duplicates found, store them in summary_metadata
    const finalMetadata = { ...summaryJson, page_count: pageCount, file_type: fileExtension,
      ...(nearDuplicates.length > 0 ? { possible_duplicates: nearDuplicates.map(d => ({ id: d.id, filename: d.filename, similarity: Math.round(d.similarity * 100) / 100 })) } : {}),
    };

    if (nearDuplicates.length > 0) {
      await updateDocumentSummary(doc.id, summaryText, finalMetadata);
    }

    return NextResponse.json({
      ...doc,
      summary: summaryText,
      summary_metadata: finalMetadata,
      near_duplicates: nearDuplicates.map(d => ({
        id: d.id,
        filename: d.filename,
        similarity: Math.round(d.similarity * 100),
      })),
    }, { status: 201 });
  } catch (err) {
    // Return the doc even if summarization fails
    return NextResponse.json({
      ...doc,
      near_duplicates: nearDuplicates.map(d => ({
        id: d.id,
        filename: d.filename,
        similarity: Math.round(d.similarity * 100),
      })),
    }, { status: 201 });
  }
}
