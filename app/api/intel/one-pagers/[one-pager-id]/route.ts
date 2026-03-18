import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { generateOnePagerDocx } from '@/lib/intel/reports/generate-one-pager-docx';
import { getOrgById } from '@/lib/intel/supabase-queries';

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'one-pager-id': id } = await params;
  const { data: record } = await supabaseAdmin
    .from('intel_one_pagers')
    .select('*')
    .eq('id', id)
    .single();

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(record.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(record);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ 'one-pager-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'one-pager-id': id } = await params;
  const { data: record } = await supabaseAdmin
    .from('intel_one_pagers')
    .select('*')
    .eq('id', id)
    .single();

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(record.org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.content) updates.content = body.content;
  if (body.title) updates.title = body.title;
  if (body.status) updates.status = body.status;
  if (body.markdown_draft) updates.markdown_draft = body.markdown_draft;

  // Regenerate docx if content was updated
  if (body.content) {
    const org = await getOrgById(record.org_id);
    let logoBuffer: Buffer | undefined;
    if (org?.branding?.logo_url) {
      try {
        const { data: logoData } = await supabaseAdmin.storage
          .from('intel')
          .download(org.branding.logo_url);
        if (logoData) {
          logoBuffer = Buffer.from(await logoData.arrayBuffer());
        }
      } catch {
        // Skip logo
      }
    }

    const docxBuffer = await generateOnePagerDocx(
      body.content,
      org?.name || 'Organization',
      org?.branding,
      logoBuffer
    );

    const storagePath = `intel/${record.org_id}/one-pagers/${id}.docx`;
    await supabaseAdmin.storage
      .from('intel')
      .upload(storagePath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    updates.docx_storage_path = storagePath;
  }

  const { data: updated } = await supabaseAdmin
    .from('intel_one_pagers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ 'one-pager-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'one-pager-id': id } = await params;
  const { data: record } = await supabaseAdmin
    .from('intel_one_pagers')
    .select('*')
    .eq('id', id)
    .single();

  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(record.org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Remove docx from storage
  if (record.docx_storage_path) {
    await supabaseAdmin.storage.from('intel').remove([record.docx_storage_path]);
  }

  await supabaseAdmin.from('intel_one_pagers').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
