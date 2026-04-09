import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess } from '@/lib/supabase'

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
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('trip_id', access.tripId)
    .order('start_time')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // FIX: Require and verify trip access
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { participant_ids, group_ids, ...rest } = body

  // FIX: Explicitly pick allowed event fields
  const { data: event, error } = await supabaseAdmin
    .from('events')
    .insert([{
      title: rest.title,
      description: rest.description || null,
      location: rest.location || null,
      start_time: rest.start_time,
      end_time: rest.end_time || null,
      type: rest.type || 'optional',
      talking_points: rest.talking_points || null,
      meeting_with: rest.meeting_with || null,
      trip_id: access.tripId,
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let allParticipantIds: string[] = [...(participant_ids || [])]

  if (group_ids && group_ids.length > 0) {
    // FIX: Only get participants from groups within this trip
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
    // FIX: Verify all participant_ids belong to this trip before joining
    const { data: validParticipants } = await supabaseAdmin
      .from('participants')
      .select('id')
      .in('id', allParticipantIds)
      .eq('trip_id', access.tripId)

    const validIds = (validParticipants || []).map((p: any) => p.id)
    if (validIds.length > 0) {
      const joins = validIds.map(pid => ({ participant_id: pid, event_id: event.id }))
      await supabaseAdmin.from('participant_events').insert(joins)
    }
  }

  return NextResponse.json(event, { status: 201 })
}
