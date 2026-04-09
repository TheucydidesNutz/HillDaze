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

  // FIX: Explicitly pick allowed fields
  const { data: event, error } = await supabaseAdmin
    .from('events')
    .update({
      title: rest.title,
      description: rest.description,
      location: rest.location,
      start_time: rest.start_time,
      end_time: rest.end_time,
      type: rest.type,
      talking_points: rest.talking_points,
      meeting_with: rest.meeting_with,
    })
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
