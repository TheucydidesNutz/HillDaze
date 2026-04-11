import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess, verifyResourceOwnership } from '@/lib/supabase'

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

  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const owns = await verifyResourceOwnership('events', id, access.tripId)
  if (!owns) return NextResponse.json({ error: 'Event not found in this trip' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('participant_events')
    .select('participant_id')
    .eq('event_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.map((r: any) => r.participant_id))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // FIX: Verify trip access and event ownership
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const owns = await verifyResourceOwnership('events', id, access.tripId)
  if (!owns) return NextResponse.json({ error: 'Event not found in this trip' }, { status: 404 })

  const body = await request.json()
  const { participant_ids, group_ids, ...rest } = body

  // Fetch current event to detect significant changes
  const { data: oldEvent } = await supabaseAdmin
    .from('events')
    .select('title, start_time, end_time, location, meeting_with')
    .eq('id', id)
    .single()

  // Normalize for comparison — strip offset from DB times, treat empty as null
  function norm(v: any) { return v || null }
  function normTime(v: string | null) {
    if (!v) return null
    return v.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '').replace(/:\d{2}$/, '') // strip seconds + offset
  }
  function normJson(v: any) { return JSON.stringify(v || null) }

  // Check if any significant fields changed (title, time, location, meeting_with)
  const significantChange = oldEvent && (
    norm(rest.title) !== norm(oldEvent.title) ||
    normTime(rest.start_time) !== normTime(oldEvent.start_time) ||
    normTime(rest.end_time) !== normTime(oldEvent.end_time) ||
    norm(rest.location) !== norm(oldEvent.location) ||
    normJson(rest.meeting_with) !== normJson(oldEvent.meeting_with)
  )

  const updatePayload: any = {
    title: rest.title,
    description: rest.description,
    location: rest.location,
    start_time: rest.start_time,
    end_time: rest.end_time,
    type: rest.type,
    talking_points: rest.talking_points,
    meeting_with: rest.meeting_with,
    meeting_lead_id: rest.meeting_lead_id !== undefined ? (rest.meeting_lead_id || null) : undefined,
  }

  if (significantChange) {
    updatePayload.significant_updated_at = new Date().toISOString()
  }

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .update(updatePayload)
    .eq('id', id)
    .eq('trip_id', access.tripId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If participant_ids is explicitly provided, replace all assignments
  if (participant_ids !== undefined) {
    await supabaseAdmin
      .from('participant_events')
      .delete()
      .eq('event_id', id)

    let allParticipantIds: string[] = [...(participant_ids || [])]

    if (group_ids && group_ids.length > 0) {
      // FIX: Scope group participant lookup to this trip
      const { data: groupParticipants } = await supabaseAdmin
        .from('participants')
        .select('id')
        .in('group_id', group_ids)
        .eq('trip_id', access.tripId)
      if (groupParticipants) {
        allParticipantIds = [...new Set([...allParticipantIds, ...groupParticipants.map((p: any) => p.id)])]
      }
    }

    if (allParticipantIds.length > 0) {
      // FIX: Verify all participant_ids belong to this trip
      const { data: validParticipants } = await supabaseAdmin
        .from('participants')
        .select('id')
        .in('id', allParticipantIds)
        .eq('trip_id', access.tripId)

      const validIds = (validParticipants || []).map((p: any) => p.id)
      if (validIds.length > 0) {
        const joins = validIds.map(pid => ({
          participant_id: pid,
          event_id: id,
        }))
        await supabaseAdmin.from('participant_events').insert(joins)
      }
    }
  }

  return NextResponse.json(event)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // FIX: Verify trip access and event ownership
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const owns = await verifyResourceOwnership('events', id, access.tripId)
  if (!owns) return NextResponse.json({ error: 'Event not found in this trip' }, { status: 404 })

  await supabaseAdmin.from('participant_events').delete().eq('event_id', id)
  const { error } = await supabaseAdmin.from('events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
