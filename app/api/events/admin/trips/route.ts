import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'
import { canCreateTrip, isExpired } from '@/lib/events/limits'
import type { SubscriptionTier } from '@/lib/events/limits'

async function getAdminUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('trip_admins')
    .select('role, trip:trips(*)')
    .eq('user_id', user.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const trips = data.map((row: any) => ({ ...row.trip, role: row.role }))
  return NextResponse.json(trips)
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch user's subscription tier and expiry
  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('subscription_tier, subscription_expires_at, display_name, phone, photo_url, company, role')
    .eq('user_id', user.id)
    .single()

  const tier = (settings?.subscription_tier || 'free') as SubscriptionTier
  const expiresAt = settings?.subscription_expires_at || null

  // Check if free tier has expired
  if (isExpired(tier, expiresAt)) {
    return NextResponse.json({
      error: 'Your free trial has expired. Please upgrade to continue creating trips.',
      code: 'TRIAL_EXPIRED',
    }, { status: 403 })
  }

  // Count current trips owned by this user
  const { count: tripCount } = await supabaseAdmin
    .from('trip_admins')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'super')

  if (!canCreateTrip(tier, tripCount || 0)) {
    return NextResponse.json({
      error: `Your ${tier} plan allows a maximum of ${tier === 'free' || tier === 'basic' ? 3 : 5} trips. Please upgrade to create more.`,
      code: 'TRIP_LIMIT_REACHED',
    }, { status: 403 })
  }

  const body = await request.json()
  const { title, start_date, end_date, timezone } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const { data: trip, error } = await supabaseAdmin
    .from('trips')
    .insert([{
      title,
      start_date: start_date || null,
      end_date: end_date || null,
      timezone: timezone || 'America/New_York',
      created_by: user.id
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add creator as super admin
  await supabaseAdmin
    .from('trip_admins')
    .insert([{ trip_id: trip.id, user_id: user.id, role: 'super', invited_by: user.id }])

  // Auto-add trip creator as participant
  const { data: existingParticipant } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('email', user.email!)
    .eq('trip_id', trip.id)
    .maybeSingle()

  if (!existingParticipant) {
    await supabaseAdmin
      .from('participants')
      .insert([{
        name: settings?.display_name || user.email || '',
        email: user.email,
        phone: settings?.phone || null,
        photo_url: settings?.photo_url || null,
        company: settings?.company || null,
        title: settings?.role || null,
        trip_id: trip.id,
      }])
  }

  // Insert default welcome broadcast for the trip
  await supabaseAdmin
    .from('broadcasts')
    .insert([{
      trip_id: trip.id,
      message: "This is where you'll see new broadcasts. Once you've read them, tap 'Got it' to delete the message.",
      sender_name: settings?.display_name || user.email || 'Your organizer',
    }])

  return NextResponse.json({ ...trip, role: 'super' }, { status: 201 })
}