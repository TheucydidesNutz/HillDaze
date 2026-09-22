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

  // Try access_token lookup first, then JWT. Also capture the viewer's
  // view_contacts flag — it gates whether roster contact details are returned.
  let tripId: string | null = null
  let canView = false

  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('trip_id, view_contacts')
    .eq('access_token', token)
    .single()

  if (participant) {
    tripId = participant.trip_id
    canView = participant.view_contacts === true
  } else {
    const participantId = await verifyToken(token)
    if (!participantId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const { data: p } = await supabaseAdmin
      .from('participants')
      .select('trip_id, view_contacts')
      .eq('id', participantId)
      .single()
    if (!p) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }
    tripId = p.trip_id
    canView = p.view_contacts === true
  }

  // Only select contact columns when the viewer is permitted, so email/phone
  // never leave the server otherwise.
  const contactCols = canView ? ', title, email, phone' : ''
  const { data: attendees, error } = await supabaseAdmin
    .from('participants')
    .select(`name, photo_url${contactCols}`)
    .eq('trip_id', tripId)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ attendees: attendees || [] })
}
