import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('start_time')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { participant_ids, group_ids, ...eventData } = body

  // Create the event
  const { data: event, error } = await supabaseAdmin
    .from('events')
    .insert([eventData])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Collect all participant IDs to assign
  let allParticipantIds: string[] = [...(participant_ids || [])]

  // If group_ids provided, get all participants in those groups
  if (group_ids && group_ids.length > 0) {
    const { data: groupParticipants } = await supabaseAdmin
      .from('participants')
      .select('id')
      .in('group_id', group_ids)

    if (groupParticipants) {
      allParticipantIds = [...new Set([...allParticipantIds, ...groupParticipants.map(p => p.id)])]
    }
  }

  // Assign participants to event
  if (allParticipantIds.length > 0) {
    const joins = allParticipantIds.map(pid => ({
      participant_id: pid,
      event_id: event.id,
    }))
    await supabaseAdmin.from('participant_events').insert(joins)
  }

  return NextResponse.json(event, { status: 201 })
}