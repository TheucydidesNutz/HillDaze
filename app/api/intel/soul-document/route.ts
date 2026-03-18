import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import {
  getLatestSoulDocument,
  saveSoulDocumentVersion,
  getUserOrgMembership,
  logActivity,
} from '@/lib/intel/supabase-queries';

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

  const doc = await getLatestSoulDocument(orgId);
  return NextResponse.json(doc);
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id, content } = await request.json();
  if (!org_id || content === undefined) {
    return NextResponse.json({ error: 'org_id and content required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const doc = await saveSoulDocumentVersion({
    org_id,
    content,
    updated_by: user.id,
  });

  if (!doc) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  await logActivity({
    org_id,
    user_id: user.id,
    action_type: 'soul_doc_edit',
    action_detail: { version: doc.version, content_length: content.length },
  });

  return NextResponse.json(doc, { status: 201 });
}
