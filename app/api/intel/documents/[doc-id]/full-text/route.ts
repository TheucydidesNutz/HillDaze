import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getDocument, getUserOrgMembership } from '@/lib/intel/supabase-queries';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ 'doc-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'doc-id': docId } = await params;
  const doc = await getDocument(docId);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const member = await getUserOrgMembership(doc.org_id, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (doc.folder !== 'deep_dive') {
    return NextResponse.json(
      { error: 'Full text not available for reference documents' },
      { status: 404 }
    );
  }

  return NextResponse.json({ full_text: doc.full_text });
}
