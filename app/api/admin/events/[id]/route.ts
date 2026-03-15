import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { participant_ids, group_ids, ...eventData } = body

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .update(eventData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If participant_ids provided, replace all assignments
  if (participant_ids !== undefined) {
    await supabaseAdmin
      .from('participant_events')
      .delete()
      .eq('event_id', id)

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
      const joins = allParticipantIds.map(pid => ({
        participant_id: pid,
        event_id: id,
      }))
      await supabaseAdmin.from('participant_events').insert(joins)
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

  await supabaseAdmin.from('participant_events').delete().eq('event_id', id)

  const { error } = await supabaseAdmin.from('events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}