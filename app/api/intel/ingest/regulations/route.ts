import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { ingestRegulationsForOrg } from '@/lib/intel/ingestion/regulations-gov';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id } = await request.json();
  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const report = await ingestRegulationsForOrg(org_id);
  return NextResponse.json({ items_added: report.items_ingested, report });
}
