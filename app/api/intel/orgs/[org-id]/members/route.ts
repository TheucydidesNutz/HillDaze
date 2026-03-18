import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership, getOrgMembers, addOrgMember } from '@/lib/intel/supabase-queries';
import type { IntelMemberRole } from '@/lib/intel/types';

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
  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await getOrgMembers(orgId);

  // Enrich with email from auth.users
  const enriched = await Promise.all(
    members.map(async (m) => {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      return {
        ...m,
        email: authUser?.user?.email || null,
      };
    })
  );

  return NextResponse.json(enriched);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ 'org-id': string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { 'org-id': orgId } = await params;
  const currentMember = await getUserOrgMembership(orgId, user.id);
  if (!currentMember || (currentMember.role !== 'super_admin' && currentMember.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { email, role, display_name, title, company } = body;

  if (!email || !role || !display_name) {
    return NextResponse.json({ error: 'email, role, and display_name are required' }, { status: 400 });
  }

  // Don't allow inviting as super_admin
  if (role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot invite as super_admin' }, { status: 400 });
  }

  // Check if user exists in auth
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === email);

  let targetUserId: string;

  if (existingUser) {
    targetUserId = existingUser.id;

    // Check if already a member
    const existing = await getUserOrgMembership(orgId, targetUserId);
    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 400 });
    }
  } else {
    // Invite the user via Supabase Auth
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) {
      return NextResponse.json({ error: 'Failed to send invite: ' + (inviteError?.message || 'Unknown error') }, { status: 500 });
    }
    targetUserId = invited.user.id;
  }

  const member = await addOrgMember({
    org_id: orgId,
    user_id: targetUserId,
    role: role as IntelMemberRole,
    display_name,
    title: title || null,
    company: company || null,
    invited_by: user.id,
  });

  if (!member) {
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }

  return NextResponse.json(member, { status: 201 });
}
