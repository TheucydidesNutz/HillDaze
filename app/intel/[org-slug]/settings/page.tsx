import Link from 'next/link';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import { redirect } from 'next/navigation';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ 'org-slug': string }>;
}) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { member } = access;
  const isAdmin = member.role === 'super_admin' || member.role === 'admin';

  const settingsLinks = [
    {
      title: 'Branding',
      description: 'Customize colors, logo, and appearance',
      href: `/intel/${orgSlug}/settings/branding`,
      enabled: isAdmin,
    },
    {
      title: 'Users',
      description: 'Manage team members and roles',
      href: `/intel/${orgSlug}/settings/users`,
      enabled: isAdmin,
    },
    {
      title: 'Feeds',
      description: 'Configure RSS and competitive feed sources',
      href: `/intel/${orgSlug}/settings/feeds`,
      enabled: isAdmin,
    },
    {
      title: 'APIs',
      description: 'Government API sources and configuration',
      href: `/intel/${orgSlug}/settings/apis`,
      enabled: isAdmin,
    },
    {
      title: 'Templates',
      description: 'Manage report templates and styling',
      href: `/intel/${orgSlug}/settings/templates`,
      enabled: isAdmin,
    },
    {
      title: 'Agent Memory',
      description: 'View and manage what the agent remembers',
      href: `/intel/${orgSlug}/settings/memory`,
      enabled: isAdmin,
    },
    ...(member.role === 'super_admin' ? [{
      title: 'Reliability',
      description: 'Team member engagement scoring',
      href: `/intel/${orgSlug}/settings/reliability`,
      enabled: true,
    }] : []),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--intel-text)] mb-8">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsLinks.map((link) => {
          const content = (
            <div
              key={link.title}
              className={`p-6 rounded-xl border border-white/10 ${
                link.enabled
                  ? 'bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors'
                  : 'bg-white/[0.01] opacity-40 cursor-not-allowed'
              }`}
            >
              <h3 className="text-base font-semibold text-[var(--intel-text)] mb-1">
                {link.title}
              </h3>
              <p className="text-sm text-[var(--intel-text)] opacity-60">
                {link.description}
              </p>
              {!link.enabled && (
                <span className="inline-block mt-2 text-xs text-[var(--intel-text)] opacity-40">
                  Coming soon
                </span>
              )}
            </div>
          );

          if (link.enabled) {
            return (
              <Link key={link.title} href={link.href}>
                {content}
              </Link>
            );
          }
          return <div key={link.title}>{content}</div>;
        })}
      </div>
    </div>
  );
}
