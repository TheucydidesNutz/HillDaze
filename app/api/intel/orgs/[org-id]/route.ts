import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getOrgById, getUserOrgMembership, updateOrgBranding, updateOrgSettings } from '@/lib/intel/supabase-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'org-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'org-id': orgId } = await params;
  const org = await getOrgById(orgId);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(org.id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(org);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ 'org-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'org-id': orgId } = await params;
  const member = await getUserOrgMembership(orgId, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  let updated;

  if (body.branding) {
    updated = await updateOrgBranding(orgId, body.branding);
  }
  if (body.settings) {
    updated = await updateOrgSettings(orgId, body.settings);
  }

  if (!updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 400 });
  }

  return NextResponse.json(updated);
}

// Logo upload handler
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ 'org-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'org-id': orgId } = await params;
  const member = await getUserOrgMembership(orgId, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const action = request.nextUrl.searchParams.get('action');
  if (action !== 'upload-logo') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'png';
  const storagePath = `intel/${orgId}/branding/logo.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from('intel')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from('intel')
    .getPublicUrl(storagePath);

  const logoUrl = publicUrlData.publicUrl;

  // Update org branding with the new logo URL
  const org = await getOrgById(orgId);
  if (org) {
    await updateOrgBranding(orgId, { ...org.branding, logo_url: logoUrl });
  }

  return NextResponse.json({ logo_url: logoUrl });
}
