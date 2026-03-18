import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getDocuments, getUserOrgMembership } from '@/lib/intel/supabase-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  const folder = request.nextUrl.searchParams.get('folder') as 'deep_dive' | 'reference' | null;
  const folderId = request.nextUrl.searchParams.get('folderId');

  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // If folderId is specified, filter by folder_id
  if (folderId) {
    const { data, error: queryError } = await supabaseAdmin
      .from('intel_documents')
      .select('*')
      .eq('org_id', orgId)
      .eq('folder_id', folderId)
      .order('uploaded_at', { ascending: false });

    console.log('[documents GET] folderId:', folderId, 'rows:', data?.length ?? 0, 'error:', queryError?.message ?? 'none');

    // Look up uploader names separately
    const docs = data || [];
    if (docs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploaderIds = [...new Set(docs.map((d: any) => d.uploaded_by).filter(Boolean))];
      const { data: members } = await supabaseAdmin
        .from('intel_org_members')
        .select('user_id, display_name')
        .eq('org_id', orgId)
        .in('user_id', uploaderIds);
      const nameMap = new Map((members || []).map(m => [m.user_id, m.display_name]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json(docs.map((d: any) => ({
        ...d,
        uploader_name: nameMap.get(d.uploaded_by) || 'Unknown',
      })));
    }
    return NextResponse.json([]);
  }

  const docs = await getDocuments(orgId, folder || undefined);
  return NextResponse.json(docs);
}
