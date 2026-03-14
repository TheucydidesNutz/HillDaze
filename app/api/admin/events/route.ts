import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, getTripId } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = getTripId(request)

  let query = supabaseAdmin.from('events').select('*').order('start_time')
  if (tripId) query = query.eq('trip_id', tripId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = getTripId(request)
  const body = await request.json()
  const { participant_ids, group_ids, ...eventData } = body

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .insert([{ ...eventData, trip_id: tripId }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let allParticipantIds: string[] = [...(participant_ids || [])]

  if (group_ids && group_ids.length > 0) {
    const { data: groupParticipants } = await supabaseAdmin
      .from('participants')
      .select('id')
      .in('group_id', group_ids)
    if (groupParticipants) {
      allParticipantIds = [...new Set([...allParticipantIds, ...groupParticipants.map((p: any) => p.id)])]
    }
  }

  if (allParticipantIds.length > 0) {
    const joins = allParticipantIds.map(pid => ({ participant_id: pid, event_id: event.id }))
    await supabaseAdmin.from('participant_events').insert(joins)
  }

  return NextResponse.json(event, { status: 201 })
}