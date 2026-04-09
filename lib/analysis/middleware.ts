import { createSupabaseServerClient } from '@/lib/supabase';
import { getOrgBySlug, getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import type { IntelOrg, IntelOrgMember } from '@/lib/intel/types';
import type { User } from '@supabase/supabase-js';
import type { Workspace } from '@/lib/analysis/types';

export async function verifyAnalysisAccess(orgSlug: string): Promise<{
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

export function hasAnalysisPermission(
  role: string,
  permission: string
): boolean {
  if (role === 'super_admin') return true;

  const rolePerms: Record<string, readonly string[]> = {
    admin: ['chat', 'upload_docs', 'view_all', 'create_profiles', 'manage_sources', 'manage_branding', 'review_anomalies', 'manage_team'],
    user: ['chat', 'upload_docs', 'view_all', 'create_profiles'],
    viewer: ['view_all'],
  };

  return rolePerms[role]?.includes(permission) ?? false;
}

export async function verifyWorkspaceAccess(orgSlug: string, workspaceSlug: string): Promise<{
  org: IntelOrg;
  member: IntelOrgMember;
  user: User;
  workspace: Workspace;
} | null> {
  const access = await verifyAnalysisAccess(orgSlug);
  if (!access) return null;

  const workspace = await getWorkspaceBySlug(access.org.id, workspaceSlug);
  if (!workspace) return null;

  return { ...access, workspace };
}
