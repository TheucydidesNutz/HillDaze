import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { jwtVerify } from 'jose'

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.PARTICIPANT_JWT_SECRET!)
    )
    return payload.sub as string
  } catch {
    return null
  }
}

async function getParticipantData(participantId: string) {
  const { data: participant, error } = await supabaseAdmin
    .from('participants')
    .select('*, group:groups(*)')
    .eq('id', participantId)
    .single()

  if (error || !participant) return null

  const { data: eventJoins } = await supabaseAdmin
    .from('participant_events')
    .select('event:events(*)')
    .eq('participant_id', participant.id)

  const events = eventJoins?.map((j: any) => j.event) || []

  const { data: factSheet } = await supabaseAdmin
    .from('fact_sheets')
    .select('*')
    .eq('is_active', true)
    .eq('trip_id', participant.trip_id)
    .maybeSingle()

  // Get trip branding + timezone
  const { data: trip } = await supabaseAdmin
    .from('trips')
    .select('id, title, start_date, end_date, logo_url, timezone')
    .eq('id', participant.trip_id)
    .single()

  return { participant, events, factSheet, trip }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // First try to find participant by access_token directly
  const { data: participant, error } = await supabaseAdmin
    .from('participants')
    .select('*, group:groups(*)')
    .eq('access_token', token)
    .single()

  if (error || !participant) {
    // Try JWT verification as fallback
    const participantId = await verifyToken(token)
    if (!participantId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const data = await getParticipantData(participantId)
    if (!data) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  const { data: eventJoins } = await supabaseAdmin
    .from('participant_events')
    .select('event:events(*)')
    .eq('participant_id', participant.id)

  const events = eventJoins?.map((j: any) => j.event) || []

  const { data: factSheet } = await supabaseAdmin
    .from('fact_sheets')
    .select('*')
    .eq('is_active', true)
    .eq('trip_id', participant.trip_id)
    .maybeSingle()

  // Get trip branding + timezone
  const { data: trip } = await supabaseAdmin
    .from('trips')
    .select('id, title, start_date, end_date, logo_url, timezone')
    .eq('id', participant.trip_id)
    .single()

  return NextResponse.json({ participant, events, factSheet, trip })
}
