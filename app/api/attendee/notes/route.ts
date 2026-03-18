import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, content } = body

  if (!token || !content) {
    return NextResponse.json({ error: 'Token and content required' }, { status: 400 })
  }

  // Find participant by token — include trip_id
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, trip_id')
    .eq('access_token', token)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Explicitly pick event_metadata if provided (never spread raw body)
  const eventMetadata = body.event_metadata
    ? {
        event_id: body.event_metadata.event_id || null,
        event_title: body.event_metadata.event_title || null,
        start_time: body.event_metadata.start_time || null,
        end_time: body.event_metadata.end_time || null,
        location: body.event_metadata.location || null,
        type: body.event_metadata.type || null,
        description: body.event_metadata.description || null,
      }
    : null

  const { data, error } = await supabaseAdmin
    .from('notes')
    .insert([{
      participant_id: participant.id,
      trip_id: participant.trip_id,
      content,
      event_metadata: eventMetadata,
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, trip_id')
    .eq('access_token', token)
    .single()

  if (!participant) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('notes')
    .select('*')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
