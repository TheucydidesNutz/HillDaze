export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise'

export const TIER_LIMITS = {
  free:       { trips: 3, participants: 15, admins: 1, expires: true },
  basic:      { trips: 3, participants: 15, admins: 1, expires: false },
  pro:        { trips: 5, participants: 25, admins: 3, expires: false },
  enterprise: { trips: Infinity, participants: Infinity, admins: Infinity, expires: false },
} as const

export const TIER_NAMES = {
  free:       'Free',
  basic:      'Basic',
  pro:        'Pro',
  enterprise: 'Enterprise',
}

export const TIER_PRICES = {
  free:       null,
  basic:      '$1.99/mo',
  pro:        '$4.99/mo',
  enterprise: '$9.99/mo',
}

export function isExpired(tier: SubscriptionTier, expiresAt: string | null): boolean {
  if (!TIER_LIMITS[tier].expires) return false
  // FIX: If the tier is supposed to expire but has no date, treat as expired
  // (prevents free-forever accounts from missing expiresAt)
  if (!expiresAt) return true
  return new Date(expiresAt) < new Date()
}

export function canCreateTrip(tier: SubscriptionTier, currentTripCount: number): boolean {
  return currentTripCount < TIER_LIMITS[tier].trips
}

export function canAddParticipant(tier: SubscriptionTier, currentCount: number): boolean {
  return currentCount < TIER_LIMITS[tier].participants
}

export function canInviteAdmin(tier: SubscriptionTier, currentAdminCount: number): boolean {
  return TIER_LIMITS[tier].admins > 1 && currentAdminCount < TIER_LIMITS[tier].admins
}
