import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess, verifyResourceOwnership } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // FIX: Verify trip access and resource ownership
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('*, group:groups(*)')
    .eq('id', id)
    .eq('trip_id', access.tripId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // FIX: Verify trip access and resource ownership
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const owns = await verifyResourceOwnership('participants', id, access.tripId)
  if (!owns) return NextResponse.json({ error: 'Participant not found in this trip' }, { status: 404 })

  const body = await request.json()

  // FIX: Explicitly pick allowed fields, and only update fields actually
  // present in the request. A partial PATCH (e.g. bulk group-assign or the
  // view_contacts toggle) must NOT blank out unrelated columns — previously
  // an absent `phone` was written as null by formatPhone(undefined).
  const updates: Record<string, any> = {}
  const setIf = (key: string, value: any) => {
    if (key in body) updates[key] = value
  }
  setIf('name', body.name)
  setIf('company', body.company)
  setIf('title', body.title)
  setIf('phone', formatPhone(body.phone))
  setIf('email', body.email)
  setIf('emergency_name', body.emergency_name)
  setIf('emergency_phone', formatPhone(body.emergency_phone))
  setIf('emergency_email', body.emergency_email)
  setIf('arrival_airline', body.arrival_airline)
  setIf('arrival_flight_no', body.arrival_flight_no)
  setIf('arrival_datetime', body.arrival_datetime)
  setIf('arrival_airport', body.arrival_airport)
  setIf('departure_airline', body.departure_airline)
  setIf('departure_flight_no', body.departure_flight_no)
  setIf('departure_datetime', body.departure_datetime)
  setIf('departure_airport', body.departure_airport)
  setIf('hotel_name', body.hotel_name)
  setIf('hotel_room', body.hotel_room)
  setIf('fun_diversions', body.fun_diversions)
  setIf('group_id', body.group_id)
  setIf('photo_url', body.photo_url)
  setIf('view_contacts', body.view_contacts)
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('participants')
    .update(updates)
    .eq('id', id)
    .eq('trip_id', access.tripId)
    .select('*, group:groups(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // FIX: Verify trip access and resource ownership
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('participants')
    .delete()
    .eq('id', id)
    .eq('trip_id', access.tripId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
