'use client'

import { useEffect, useState } from 'react'
import { TIER_LIMITS, TIER_NAMES, isExpired } from '@/lib/events/limits'
import type { SubscriptionTier } from '@/lib/events/limits'

interface UsageData {
  tier: SubscriptionTier
  expiresAt: string | null
  tripCount: number
}

export default function UsageBanner() {
  const [usage, setUsage] = useState<UsageData | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/events/admin/usage')
      if (!res.ok) return
      const data = await res.json()
      setUsage({
        tier: data.tier as SubscriptionTier,
        expiresAt: data.expiresAt,
        tripCount: data.tripCount,
      })
    }
    load()
  }, [])

  if (!usage) return null

  const limits = TIER_LIMITS[usage.tier]
  const expired = isExpired(usage.tier, usage.expiresAt)
  const tripLimitHit = usage.tripCount >= limits.trips

  let daysRemaining: number | null = null
  if (usage.tier === 'free' && usage.expiresAt) {
    daysRemaining = Math.ceil(
      (new Date(usage.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  }

  if (expired) {
    return (
      <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-red-400 font-medium text-sm">Your free trial has expired</p>
          <p className="text-red-400/70 text-xs mt-0.5">Upgrade to continue creating trips and managing participants.</p>
        </div>
        <a href="/pricing" className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0">
          Upgrade
        </a>
      </div>
    )
  }

  return (
    <div className="mb-6 bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">

          {/* Tier badge */}
          <div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              usage.tier === 'enterprise' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
              usage.tier === 'pro'        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              usage.tier === 'basic'      ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            'bg-slate-700 text-slate-400 border-slate-600'
            }`}>
              {TIER_NAMES[usage.tier]}
            </span>
          </div>

          {/* Trip usage */}
          {limits.trips !== Infinity && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: limits.trips }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < usage.tripCount ? 'bg-blue-500' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-slate-400 text-xs">
                {usage.tripCount} of {limits.trips} trip{limits.trips !== 1 ? 's' : ''} used
              </span>
            </div>
          )}

          {limits.trips === Infinity && (
            <span className="text-slate-400 text-xs">
              {usage.tripCount} trip{usage.tripCount !== 1 ? 's' : ''} · unlimited
            </span>
          )}

          {/* Free tier expiry */}
          {usage.tier === 'free' && daysRemaining !== null && (
            <span className={`text-xs ${daysRemaining <= 14 ? 'text-amber-400' : 'text-slate-500'}`}>
              {daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
                : 'Expires today'}
            </span>
          )}
        </div>

        {/* Upgrade CTA */}
        {usage.tier !== 'enterprise' && (
          <a href="/pricing" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
            Upgrade →
          </a>
        )}
      </div>

      {/* Warning when at limit */}
      {tripLimitHit && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <p className="text-amber-400 text-xs">
            You've reached your trip limit.{' '}
            <a href="/pricing" className="underline hover:text-amber-300">Upgrade your plan</a>
            {' '}to create more trips.
          </p>
        </div>
      )}
    </div>
  )
}