import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { token, ...fields } = body

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  // Find participant by access token
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, name, email, trip_id')
    .eq('access_token', token)
    .single()

  if (!participant) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // Preserve last name — split on last space
  const nameParts = participant.name.trim().split(/\s+/)
  const existingLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
  let newName = participant.name
  if (fields.first_name !== undefined) {
    const firstName = fields.first_name.trim()
    newName = existingLastName ? `${firstName} ${existingLastName}` : firstName
  }

  // Whitelist allowed fields — email, last name, and group_id are NOT editable
  const update: Record<string, any> = {
    name: newName,
    company: fields.company ?? null,
    title: fields.title ?? null,
    phone: formatPhone(fields.phone),
    emergency_name: fields.emergency_name ?? null,
    emergency_phone: formatPhone(fields.emergency_phone),
    emergency_email: fields.emergency_email ?? null,
    arrival_airline: fields.arrival_airline ?? null,
    arrival_flight_no: fields.arrival_flight_no ?? null,
    arrival_datetime: fields.arrival_datetime || null,
    arrival_airport: fields.arrival_airport ?? null,
    departure_airline: fields.departure_airline ?? null,
    departure_flight_no: fields.departure_flight_no ?? null,
    departure_datetime: fields.departure_datetime || null,
    departure_airport: fields.departure_airport ?? null,
    hotel_name: fields.hotel_name ?? null,
    hotel_room: fields.hotel_room ?? null,
    fun_diversions: fields.fun_diversions ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('participants')
    .update(update)
    .eq('id', participant.id)
    .select('*, group:groups(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
