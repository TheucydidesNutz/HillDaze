import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess } from '@/lib/supabase'
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

  // FIX: Require and verify trip access
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden — no access to this trip' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('*, group:groups(*)')
    .eq('trip_id', access.tripId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // FIX: Require and verify trip access
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden — no access to this trip' }, { status: 403 })

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

  // Count current participants in this trip (using verified tripId)
  const { count: participantCount } = await supabaseAdmin
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', access.tripId)

  if (!canAddParticipant(tier, participantCount || 0)) {
    return NextResponse.json({
      error: `Your ${tier} plan allows a maximum of ${tier === 'free' || tier === 'basic' ? 15 : 25} participants per trip. Please upgrade to add more.`,
      code: 'PARTICIPANT_LIMIT_REACHED',
    }, { status: 403 })
  }

  const body = await request.json()

  // FIX: Explicitly pick allowed fields instead of spreading raw body
  const { data, error } = await supabaseAdmin
    .from('participants')
    .insert([{
      name: body.name,
      company: body.company || null,
      title: body.title || null,
      phone: formatPhone(body.phone),
      email: body.email || null,
      emergency_name: body.emergency_name || null,
      emergency_phone: formatPhone(body.emergency_phone),
      emergency_email: body.emergency_email || null,
      arrival_airline: body.arrival_airline || null,
      arrival_flight_no: body.arrival_flight_no || null,
      arrival_datetime: body.arrival_datetime || null,
      arrival_airport: body.arrival_airport || null,
      departure_airline: body.departure_airline || null,
      departure_flight_no: body.departure_flight_no || null,
      departure_datetime: body.departure_datetime || null,
      departure_airport: body.departure_airport || null,
      hotel_name: body.hotel_name || null,
      hotel_room: body.hotel_room || null,
      fun_diversions: body.fun_diversions || null,
      group_id: body.group_id || null,
      photo_url: body.photo_url || null,
      trip_id: access.tripId,
    }])
    .select('*, group:groups(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
