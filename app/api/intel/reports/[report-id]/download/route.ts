import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'report-id': string }> }
) {
  const user = await getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { 'report-id': id } = await params;
  const { data: report } = await supabaseAdmin.from('intel_monthly_summaries').select('*').eq('id', id).single();
  if (!report) return new Response('Not found', { status: 404 });

  const member = await getUserOrgMembership(report.org_id, user.id);
  if (!member) return new Response('Forbidden', { status: 403 });

  if (!report.docx_storage_path) {
    return new Response('No document file available', { status: 404 });
  }

  const { data: fileData, error } = await supabaseAdmin.storage.from('intel').download(report.docx_storage_path);
  if (error || !fileData) return new Response('File not found', { status: 404 });

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const filename = `report_${report.month}.docx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
