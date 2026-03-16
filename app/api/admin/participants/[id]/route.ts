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

  // FIX: Explicitly pick allowed fields
  const { data, error } = await supabaseAdmin
    .from('participants')
    .update({
      name: body.name,
      company: body.company,
      title: body.title,
      phone: formatPhone(body.phone),
      email: body.email,
      emergency_name: body.emergency_name,
      emergency_phone: formatPhone(body.emergency_phone),
      emergency_email: body.emergency_email,
      arrival_airline: body.arrival_airline,
      arrival_flight_no: body.arrival_flight_no,
      arrival_datetime: body.arrival_datetime,
      arrival_airport: body.arrival_airport,
      departure_airline: body.departure_airline,
      departure_flight_no: body.departure_flight_no,
      departure_datetime: body.departure_datetime,
      departure_airport: body.departure_airport,
      hotel_name: body.hotel_name,
      hotel_room: body.hotel_room,
      fun_diversions: body.fun_diversions,
      group_id: body.group_id,
      photo_url: body.photo_url,
      updated_at: new Date().toISOString()
    })
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
