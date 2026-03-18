import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership, updateMemberRole, removeMember } from '@/lib/intel/supabase-queries';
import type { IntelMemberRole } from '@/lib/intel/types';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

type RouteParams = { params: Promise<{ 'org-id': string; 'member-id': string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'org-id': orgId, 'member-id': memberId } = await params;
  const currentMember = await getUserOrgMembership(orgId, user.id);
  if (!currentMember || (currentMember.role !== 'super_admin' && currentMember.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { role } = body as { role: IntelMemberRole };

  if (!role || role === 'super_admin') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Admins cannot change other admins' roles
  // We need to check the target member's current role
  const { data: targetMember } = await supabaseAdmin
    .from('intel_org_members').select('role').eq('id', memberId).single();

  if (targetMember?.role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot change super_admin role' }, { status: 403 });
  }

  if (currentMember.role === 'admin' && targetMember?.role === 'admin') {
    return NextResponse.json({ error: 'Admins cannot change other admin roles' }, { status: 403 });
  }

  const updated = await updateMemberRole(memberId, role);
  if (!updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 400 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'org-id': orgId, 'member-id': memberId } = await params;
  const currentMember = await getUserOrgMembership(orgId, user.id);
  if (!currentMember || (currentMember.role !== 'super_admin' && currentMember.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent removing super_admins
  const { data: targetMember } = await supabaseAdmin
    .from('intel_org_members').select('role').eq('id', memberId).single();

  if (targetMember?.role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot remove super_admin' }, { status: 403 });
  }

  const success = await removeMember(memberId);
  if (!success) {
    return NextResponse.json({ error: 'Removal failed' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
