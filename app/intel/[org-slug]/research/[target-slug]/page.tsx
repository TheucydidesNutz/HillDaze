import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import { supabaseAdmin } from '@/lib/supabase';
import ResearchTargetWorkspace from '@/components/intel/ResearchTargetWorkspace';

export default async function ResearchTargetPage({
  params,
}: {
  params: Promise<{ 'org-slug': string; 'target-slug': string }>;
}) {
  const { 'org-slug': orgSlug, 'target-slug': targetSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org, member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  // Look up target by slug
  const { data: target } = await supabaseAdmin
    .from('intel_research_targets')
    .select('id')
    .eq('org_id', org.id)
    .eq('slug', targetSlug)
    .single();

  if (!target) redirect(`/intel/${orgSlug}/research`);

  return (
    <ResearchTargetWorkspace
      targetId={target.id}
      orgId={org.id}
      orgSlug={orgSlug}
      isAdmin={isAdmin}
    />
  );
}
