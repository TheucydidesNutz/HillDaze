import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { updateOrgBranding } from '@/lib/intel/supabase-queries';

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, branding } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await updateOrgBranding(org_id, branding);
  if (!updated) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });

  return NextResponse.json({ org: updated });
}
