'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import OrgSelector from '@/components/intel/OrgSelector';

interface OrgMembership {
  id: string;
  org_id: string;
  role: string;
  org: {
    id: string;
    name: string;
    slug: string;
    branding: {
      logo_url: string | null;
      primary_color: string;
    };
  };
}

export default function IntelLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [memberships, setMemberships] = useState<OrgMembership[] | null>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check for existing session on mount
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await handlePostLogin(user.id);
      }
      setCheckingSession(false);
    }
    checkSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePostLogin(userId: string) {
    const res = await fetch('/api/intel/orgs');
    if (!res.ok) {
      setError('Failed to load organizations');
      return;
    }
    const orgs: OrgMembership[] = await res.json();

    if (orgs.length === 1) {
      router.push(`/intel/${orgs[0].org.slug}`);
      router.refresh();
    } else if (orgs.length > 1) {
      setMemberships(orgs);
    } else {
      setError('No organizations found. Contact your administrator to get access.');
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await handlePostLogin(data.user.id);
    }
    setLoading(false);
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-[#a0a0b8]">Loading...</div>
      </div>
    );
  }

  // Show org selector if user has multiple orgs
  if (memberships) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">Select Organization</h1>
            <p className="text-[#a0a0b8] mt-2">Choose which organization to access</p>
          </div>
          <OrgSelector
            memberships={memberships.map((m) => ({
              slug: m.org.slug,
              name: m.org.name,
              logo_url: m.org.branding.logo_url,
              primary_color: m.org.branding.primary_color,
              role: m.role,
            }))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
              CI
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Covaled Intelligence</h1>
          <p className="text-[#a0a0b8] mt-2">Sign in to your intelligence portal</p>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#c0c0d0] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-[#606080] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#c0c0d0] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-lg text-white placeholder-[#606080] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors mt-2"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-[#606080] text-sm text-center mt-6">
          <a href="/intel" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Covaled Intelligence
          </a>
        </p>
      </div>
    </div>
  );
}
