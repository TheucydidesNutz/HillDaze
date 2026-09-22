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

// Build the full attendee payload for a given (already looked-up) participant.
// The viewer's own `view_contacts` flag gates whether teammate email/phone are
// included at all — when it's off, those columns are never selected, so the
// contact details never leave the server.
async function buildPayload(participant: any) {
  const canView = participant.view_contacts === true
  const contactCols = canView ? ', email, phone' : ''

  const { data: eventJoins } = await supabaseAdmin
    .from('participant_events')
    .select('event:events(*)')
    .eq('participant_id', participant.id)

  const rawEvents = eventJoins?.map((j: any) => j.event) || []

  // Resolve meeting leads for events that have one
  const leadIds = [...new Set(rawEvents.filter((e: any) => e.meeting_lead_id).map((e: any) => e.meeting_lead_id))]
  let leadMap: Record<string, any> = {}
  if (leadIds.length > 0) {
    const { data: leads } = await supabaseAdmin
      .from('participants')
      .select(`id, name, title, photo_url${contactCols}`)
      .in('id', leadIds)
    if (leads) {
      leadMap = Object.fromEntries(leads.map((l: any) => [l.id, {
        name: l.name,
        title: l.title,
        photo_url: l.photo_url,
        ...(canView ? { email: l.email ?? null, phone: l.phone ?? null } : {}),
      }]))
    }
  }

  // Resolve team attendees for each event
  const eventIds = rawEvents.map((e: any) => e.id)
  let attendeesMap: Record<string, any[]> = {}
  if (eventIds.length > 0) {
    const { data: allJoins } = await supabaseAdmin
      .from('participant_events')
      .select(`event_id, participant:participants(id, name, title, photo_url${contactCols})`)
      .in('event_id', eventIds)
    if (allJoins) {
      for (const j of allJoins as any[]) {
        if (!attendeesMap[j.event_id]) attendeesMap[j.event_id] = []
        if (j.participant) attendeesMap[j.event_id].push(j.participant)
      }
    }
  }

  const events = rawEvents.map((e: any) => ({
    ...e,
    meeting_lead: e.meeting_lead_id ? leadMap[e.meeting_lead_id] || null : null,
    team_attendees: attendeesMap[e.id] || [],
  }))

  const { data: factSheet } = await supabaseAdmin
    .from('fact_sheets')
    .select('*')
    .eq('is_active', true)
    .eq('trip_id', participant.trip_id)
    .maybeSingle()

  // Get trip branding + timezone
  const { data: trip } = await supabaseAdmin
    .from('trips')
    .select('id, title, start_date, end_date, logo_url, timezone, theme')
    .eq('id', participant.trip_id)
    .single()

  return { participant, events, factSheet, trip }
}

async function getParticipantData(participantId: string) {
  const { data: participant, error } = await supabaseAdmin
    .from('participants')
    .select('*, group:groups(*)')
    .eq('id', participantId)
    .single()

  if (error || !participant) return null
  return buildPayload(participant)
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

  return NextResponse.json(await buildPayload(participant))
}
