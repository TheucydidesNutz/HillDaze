import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let { data: folders } = await supabaseAdmin
    .from('intel_document_folders')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!folders) folders = [];

  // Ensure the two root default folders exist (create only what's missing)
  const hasDeepDive = folders.some(f => !f.parent_id && f.folder_type === 'deep_dive');
  const hasReference = folders.some(f => !f.parent_id && f.folder_type === 'reference');

  if (!hasDeepDive || !hasReference) {
    const toInsert = [];
    if (!hasDeepDive) {
      toInsert.push({
        org_id: orgId,
        name: 'Deep Dive',
        slug: 'deep-dive',
        folder_type: 'deep_dive',
        description: 'Full analytical documents the Intelligence Analyst can read in their entirety. Upload legislation, regulations, academic papers, industry reports, and detailed policy analyses.',
        sort_order: 0,
      });
    }
    if (!hasReference) {
      toInsert.push({
        org_id: orgId,
        name: 'Reference',
        slug: 'reference',
        folder_type: 'reference',
        description: 'Tone and style reference materials. Upload past op-eds, position papers, testimony transcripts, and writing samples. The AI reads these for voice and framing, not detailed analysis.',
        sort_order: 1,
      });
    }

    const { data: created } = await supabaseAdmin
      .from('intel_document_folders')
      .insert(toInsert)
      .select();

    if (created) {
      folders = [...folders, ...created];
    }
  }

  // Backfill any documents with null folder_id
  const ddFolder = folders.find(f => f.folder_type === 'deep_dive' && !f.parent_id);
  const refFolder = folders.find(f => f.folder_type === 'reference' && !f.parent_id);

  const { count: orphanCount } = await supabaseAdmin
    .from('intel_documents')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('folder_id', null);

  if (orphanCount && orphanCount > 0) {
    if (ddFolder) {
      await supabaseAdmin
        .from('intel_documents')
        .update({ folder_id: ddFolder.id })
        .eq('org_id', orgId)
        .eq('folder', 'deep_dive')
        .is('folder_id', null);
    }
    if (refFolder) {
      await supabaseAdmin
        .from('intel_documents')
        .update({ folder_id: refFolder.id })
        .eq('org_id', orgId)
        .eq('folder', 'reference')
        .is('folder_id', null);
    }
  }

  // Adopt orphaned top-level custom folders: move them under Deep Dive
  if (ddFolder) {
    const orphanFolders = folders.filter(f => !f.parent_id && f.folder_type === 'custom');
    for (const orphan of orphanFolders) {
      console.log(`[document-folders] Adopting orphaned top-level folder "${orphan.name}" (${orphan.id}) under Deep Dive for org ${orgId}`);
      await supabaseAdmin
        .from('intel_document_folders')
        .update({ parent_id: ddFolder.id, folder_type: 'deep_dive' })
        .eq('id', orphan.id);
      orphan.parent_id = ddFolder.id;
      orphan.folder_type = 'deep_dive';
    }
  }

  // Get document counts per folder
  const { data: counts } = await supabaseAdmin
    .from('intel_documents')
    .select('folder_id')
    .eq('org_id', orgId)
    .not('folder_id', 'is', null);

  const countMap: Record<string, number> = {};
  for (const row of counts || []) {
    if (row.folder_id) {
      countMap[row.folder_id] = (countMap[row.folder_id] || 0) + 1;
    }
  }

  const foldersWithCounts = (folders || []).map(f => ({
    ...f,
    doc_count: countMap[f.id] || 0,
  }));

  return NextResponse.json(foldersWithCounts);
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, name, parent_id, description } = body;

  if (!org_id || !name) {
    return NextResponse.json({ error: 'org_id and name required' }, { status: 400 });
  }

  // Require parent_id — all user-created folders must be inside Deep Dive or Reference
  if (!parent_id) {
    return NextResponse.json({ error: 'Folders must be created inside Deep Dive or Reference.' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);

  // Walk up to the root folder to determine folder_type
  let folder_type = 'custom';
  let walkId: string | null = parent_id;
  while (walkId) {
    const result = await supabaseAdmin
      .from('intel_document_folders')
      .select('folder_type, parent_id')
      .eq('id', walkId)
      .single();
    const ancestor = result.data as { folder_type: string; parent_id: string | null } | null;
    if (!ancestor) break;
    if (!ancestor.parent_id) {
      // This is a root folder — use its type
      folder_type = ancestor.folder_type;
      break;
    }
    walkId = ancestor.parent_id;
  }

  // Get next sort_order
  const { data: siblings } = await supabaseAdmin
    .from('intel_document_folders')
    .select('sort_order')
    .eq('org_id', org_id)
    .eq('parent_id', parent_id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const sortOrder = siblings && siblings.length > 0 ? siblings[0].sort_order + 1 : 0;

  const { data: folder, error } = await supabaseAdmin
    .from('intel_document_folders')
    .insert({
      org_id,
      parent_id: parent_id || null,
      name,
      slug,
      folder_type,
      description: description || null,
      sort_order: sortOrder,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A folder with this name already exists in this location' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }

  return NextResponse.json(folder, { status: 201 });
}
