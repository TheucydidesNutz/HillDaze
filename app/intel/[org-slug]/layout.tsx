import { redirect } from 'next/navigation';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import { getBrandingStyles } from '@/lib/intel/branding';
import IntelLayout from '@/components/intel/IntelLayout';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ 'org-slug': string }>;
}) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);

  if (!access) {
    redirect('/intel/login');
  }

  const { org, member, user } = access;
  const brandingStyles = getBrandingStyles(org.branding);

  return (
    <div
      style={brandingStyles}
      className="min-h-screen"
    >
      <IntelLayout
        org={{ id: org.id, name: org.name, slug: org.slug, branding: org.branding }}
        member={{ role: member.role, display_name: member.display_name }}
        userEmail={user.email || ''}
      >
        {children}
      </IntelLayout>
    </div>
  );
}
