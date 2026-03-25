import { redirect } from 'next/navigation'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { CalendarDays, Radar, ScanSearch } from 'lucide-react'

interface ProductAccess {
  hasAccess: boolean
  href: string
}

async function getAccessInfo(userId: string) {
  const [tripAdminResult, intelMemberResult, analysisMemberResult, settingsResult] = await Promise.all([
    // Events: check trip_admins
    supabaseAdmin
      .from('trip_admins')
      .select('id')
      .eq('user_id', userId)
      .limit(1),
    // Intel: check intel_org_members + get org slugs
    supabaseAdmin
      .from('intel_org_members')
      .select('org:intel_organizations(slug)')
      .eq('user_id', userId),
    // Analysis: uses same intel_org_members table
    supabaseAdmin
      .from('intel_org_members')
      .select('org:intel_organizations(slug)')
      .eq('user_id', userId),
    // Display name
    supabaseAdmin
      .from('user_settings')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const tripAdmins = tripAdminResult.data || []
  const intelMembers = intelMemberResult.data || []
  const analysisMembers = analysisMemberResult.data || []

  // Intel link: single org → direct, multiple → selector
  let intelHref = '/intel/login'
  if (intelMembers.length === 1) {
    const slug = (intelMembers[0] as any)?.org?.slug
    if (slug) intelHref = `/intel/${slug}`
  } else if (intelMembers.length > 1) {
    intelHref = '/intel/login'
  }

  // Analysis link: same pattern
  let analysisHref = '/analysis/login'
  if (analysisMembers.length === 1) {
    const slug = (analysisMembers[0] as any)?.org?.slug
    if (slug) analysisHref = `/analysis/${slug}/dashboard`
  } else if (analysisMembers.length > 1) {
    analysisHref = '/analysis/login'
  }

  return {
    displayName: settingsResult.data?.display_name || null,
    events: { hasAccess: tripAdmins.length > 0, href: '/events/admin/trips' } as ProductAccess,
    intel: { hasAccess: intelMembers.length > 0, href: intelHref } as ProductAccess,
    analysis: { hasAccess: analysisMembers.length > 0, href: analysisHref } as ProductAccess,
  }
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/events/admin/login')

  const { displayName, events, intel, analysis } = await getAccessInfo(user.id)
  const greeting = displayName || user.email?.split('@')[0] || 'there'

  const products = [
    {
      name: 'Events',
      description: 'Manage trips, schedules, and attendee microsites',
      icon: CalendarDays,
      color: 'blue',
      access: events,
    },
    {
      name: 'Intel',
      description: 'Trade group intelligence and policy monitoring',
      icon: Radar,
      color: 'emerald',
      access: intel,
    },
    {
      name: 'Analysis',
      description: 'Person-profile research and deep analysis',
      icon: ScanSearch,
      color: 'purple',
      access: analysis,
    },
  ]

  const colorMap: Record<string, { bg: string; border: string; icon: string; hoverBorder: string }> = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400', hoverBorder: 'hover:border-blue-500/50' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400', hoverBorder: 'hover:border-emerald-500/50' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400', hoverBorder: 'hover:border-purple-500/50' },
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Logo / Wordmark */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white tracking-tight">Covaled</h1>
          <p className="text-slate-400 mt-2">Welcome back, {greeting}</p>
        </div>

        {/* Product Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {products.map(product => {
            const c = colorMap[product.color]
            const Icon = product.icon
            const hasAccess = product.access.hasAccess

            const card = (
              <div
                className={`rounded-2xl border p-6 transition-all duration-200 ${
                  hasAccess
                    ? `bg-slate-900 border-slate-800 ${c.hoverBorder} cursor-pointer hover:scale-[1.02] hover:shadow-lg`
                    : 'bg-slate-900/50 border-slate-800/50 opacity-50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${hasAccess ? c.icon : 'text-slate-600'}`} />
                </div>
                <h2 className="text-white font-semibold text-lg mb-1">{product.name}</h2>
                <p className="text-slate-400 text-sm">{product.description}</p>
                {!hasAccess && (
                  <p className="text-slate-600 text-xs mt-3">Contact admin for access</p>
                )}
              </div>
            )

            if (hasAccess) {
              return (
                <Link key={product.name} href={product.access.href}>
                  {card}
                </Link>
              )
            }
            return <div key={product.name}>{card}</div>
          })}
        </div>
      </div>
    </div>
  )
}
