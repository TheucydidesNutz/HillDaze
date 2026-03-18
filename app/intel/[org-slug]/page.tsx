import Link from 'next/link';
import { verifyOrgAccess } from '@/lib/intel/middleware';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCount(query: PromiseLike<{ count: number | null }>): Promise<number> {
  try { return (await query).count || 0; } catch { return 0; }
}

export default async function OrgDashboard({
  params,
}: {
  params: Promise<{ 'org-slug': string }>;
}) {
  const { 'org-slug': orgSlug } = await params;
  const access = await verifyOrgAccess(orgSlug);
  if (!access) redirect('/intel/login');

  const { org } = access;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [pendingCount, recsCount, trendsCount, weekConvos, weekDocs, newsCount] = await Promise.all([
    safeCount(supabaseAdmin.from('intel_focus_proposals').select('*', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'pending')),
    safeCount(supabaseAdmin.from('intel_article_recommendations').select('*', { count: 'exact', head: true }).eq('org_id', org.id)),
    safeCount(supabaseAdmin.from('intel_trend_reports').select('*', { count: 'exact', head: true }).eq('org_id', org.id)),
    safeCount(supabaseAdmin.from('intel_conversations').select('*', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', weekAgo)),
    safeCount(supabaseAdmin.from('intel_documents').select('*', { count: 'exact', head: true }).eq('org_id', org.id).gte('uploaded_at', weekAgo)),
    safeCount(supabaseAdmin.from('intel_news_items').select('*', { count: 'exact', head: true }).eq('org_id', org.id)),
  ]);

  const cards = [
    { title: 'Pending Approvals', value: String(pendingCount), href: `focus`, color: pendingCount > 0 ? '#ef4444' : undefined },
    { title: 'Article Pitches', value: String(recsCount), href: `recommendations` },
    { title: 'Trend Reports', value: String(trendsCount), href: `trends` },
    { title: 'News Items Tracked', value: String(newsCount), href: `chat` },
  ];

  const stats = [
    { label: 'Conversations this week', value: weekConvos },
    { label: 'Docs processed this week', value: weekDocs },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--intel-text)] mb-2">
        Welcome to {org.name} Intelligence
      </h1>
      <p className="text-sm opacity-40 text-[var(--intel-text)] mb-8">
        Your AI-powered policy intelligence command center
      </p>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link href={`/intel/${orgSlug}/briefing`} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>
          View Briefing
        </Link>
        <Link href={`/intel/${orgSlug}/chat`} className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/[0.05] text-[var(--intel-text)]">
          Open Chat
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Link key={card.title} href={`/intel/${orgSlug}/${card.href}`}>
            <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <h3 className="text-xs font-medium text-[var(--intel-text)] opacity-50 mb-2">
                {card.title}
              </h3>
              <p className="text-2xl font-bold" style={{ color: card.color || 'var(--intel-text)' }}>
                {card.value}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Activity stats */}
      <div className="flex flex-wrap gap-6 mb-8">
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--intel-text)]">{s.value}</span>
            <span className="text-xs opacity-40 text-[var(--intel-text)]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Get started link */}
      <Link
        href={`/intel/${orgSlug}/soul-document`}
        className="inline-flex items-center gap-2 text-[var(--intel-primary)] hover:underline text-sm"
      >
        Edit your Soul Document &rarr;
      </Link>
    </div>
  );
}
