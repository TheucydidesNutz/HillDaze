import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, getTripId } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'
import { canAddParticipant, isExpired } from '@/lib/limits'
import type { SubscriptionTier } from '@/lib/limits'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = getTripId(request)

  let query = supabaseAdmin
    .from('participants')
    .select('*, group:groups(*)')
    .order('name')

  if (tripId) query = query.eq('trip_id', tripId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = getTripId(request)

  // Fetch user's subscription tier and expiry
  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('subscription_tier, subscription_expires_at')
    .eq('user_id', user.id)
    .single()

  const tier = (settings?.subscription_tier || 'free') as SubscriptionTier
  const expiresAt = settings?.subscription_expires_at || null

  // Check if free tier has expired
  if (isExpired(tier, expiresAt)) {
    return NextResponse.json({
      error: 'Your free trial has expired. Please upgrade to continue adding participants.',
      code: 'TRIAL_EXPIRED',
    }, { status: 403 })
  }

  // Count current participants in this trip
  const { count: participantCount } = await supabaseAdmin
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', tripId)

  if (!canAddParticipant(tier, participantCount || 0)) {
    return NextResponse.json({
      error: `Your ${tier} plan allows a maximum of ${tier === 'free' || tier === 'basic' ? 15 : 25} participants per trip. Please upgrade to add more.`,
      code: 'PARTICIPANT_LIMIT_REACHED',
    }, { status: 403 })
  }

  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('participants')
    .insert([{
      ...body,
      phone: formatPhone(body.phone),
      emergency_phone: formatPhone(body.emergency_phone),
      trip_id: tripId
    }])
    .select('*, group:groups(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}