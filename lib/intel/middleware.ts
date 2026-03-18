import { createSupabaseServerClient } from '@/lib/supabase';
import { getOrgBySlug, getUserOrgMembership } from './supabase-queries';
import type { IntelOrg, IntelOrgMember } from './types';
import type { User } from '@supabase/supabase-js';

export async function verifyOrgAccess(orgSlug: string): Promise<{
  org: IntelOrg;
  member: IntelOrgMember;
  user: User;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const org = await getOrgBySlug(orgSlug);
  if (!org) return null;

  const member = await getUserOrgMembership(org.id, user.id);
  if (!member) return null;

  return { org, member, user };
}

export function hasPermission(
  role: string,
  permission: string
): boolean {
  if (role === 'super_admin') return true;

  const rolePerms: Record<string, readonly string[]> = {
    admin: ['chat', 'upload_docs', 'view_all', 'request_drafts', 'approve_proposals', 'manage_feeds', 'manage_branding'],
    user: ['chat', 'upload_docs', 'view_all', 'request_drafts'],
    viewer: ['view_all'],
  };

  return rolePerms[role]?.includes(permission) ?? false;
}
