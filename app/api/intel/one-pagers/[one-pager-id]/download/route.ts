import { NextRequest } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'one-pager-id': string }> }
) {
  const user = await getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { 'one-pager-id': id } = await params;
  const { data: record } = await supabaseAdmin
    .from('intel_one_pagers')
    .select('*')
    .eq('id', id)
    .single();

  if (!record) return new Response('Not found', { status: 404 });

  const member = await getUserOrgMembership(record.org_id, user.id);
  if (!member) return new Response('Forbidden', { status: 403 });

  if (!record.docx_storage_path) {
    return new Response('No document file available', { status: 404 });
  }

  const { data: fileData, error } = await supabaseAdmin.storage
    .from('intel')
    .download(record.docx_storage_path);

  if (error || !fileData) return new Response('File not found', { status: 404 });

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const safeTitle = (record.title || 'one-pager')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeTitle}.docx"`,
    },
  });
}
