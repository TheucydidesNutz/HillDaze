'use client';

import { useRouter } from 'next/navigation';

interface OrgOption {
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  role: string;
}

export default function OrgSelector({ memberships }: { memberships: OrgOption[] }) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {memberships.map((org) => (
        <button
          key={org.slug}
          onClick={() => {
            router.push(`/intel/${org.slug}`);
            router.refresh();
          }}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] transition-colors text-left"
        >
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: org.primary_color }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-white font-medium">{org.name}</div>
            <div className="text-sm text-[#a0a0b8] capitalize">{org.role.replace('_', ' ')}</div>
          </div>
          <svg
            className="w-5 h-5 text-[#606080] ml-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  );
}
