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

    const { data: p2 } = await supabaseAdmin
      .from('participants')
      .select('*, group:groups(*)')
      .eq('id', participantId)
      .single()

    if (!p2) return NextResponse.json({ error: 'Participant not found' }, { status: 404 })

    // Get events
    const { data: eventJoins } = await supabaseAdmin
      .from('participant_events')
      .select('event:events(*)')
      .eq('participant_id', p2.id)

    const events = eventJoins?.map((j: any) => j.event) || []

    // Get active fact sheet
    const { data: factSheet } = await supabaseAdmin
      .from('fact_sheets')
      .select('*')
      .eq('is_active', true)
      .single()

    return NextResponse.json({ participant: p2, events, factSheet })
  }

  // Get events for participant
  const { data: eventJoins } = await supabaseAdmin
    .from('participant_events')
    .select('event:events(*)')
    .eq('participant_id', participant.id)

  const events = eventJoins?.map((j: any) => j.event) || []

  // Get active fact sheet
  const { data: factSheet } = await supabaseAdmin
    .from('fact_sheets')
    .select('*')
    .eq('is_active', true)
    .single()

  return NextResponse.json({ participant, events, factSheet })
}