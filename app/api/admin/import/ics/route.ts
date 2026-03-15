import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, getTripId } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseICS(text: string) {
  const events: any[] = []
  const lines = text.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r\n|\n/)

  let current: any = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT' && current) {
      if (current.title && current.start) events.push(current)
      current = null
    } else if (current) {
      if (line.startsWith('SUMMARY:')) {
        current.title = line.replace('SUMMARY:', '').trim()
      } else if (line.startsWith('DESCRIPTION:')) {
        current.description = line.replace('DESCRIPTION:', '').trim()
      } else if (line.startsWith('LOCATION:')) {
        current.location = line.replace('LOCATION:', '').trim()
      } else if (line.startsWith('DTSTART')) {
        const val = line.split(':').slice(1).join(':').trim()
        current.start = parseICSDate(val)
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':').slice(1).join(':').trim()
        current.end = parseICSDate(val)
      }
    }
  }

  return events
}

function parseICSDate(val: string): string {
  const clean = val.includes(':') ? val.split(':').slice(1).join(':') : val

  if (clean.includes('T')) {
    const y = clean.slice(0, 4)
    const mo = clean.slice(4, 6)
    const d = clean.slice(6, 8)
    const h = clean.slice(9, 11)
    const mi = clean.slice(11, 13)
    return `${y}-${mo}-${d}T${h}:${mi}:00`
  } else {
    const y = clean.slice(0, 4)
    const mo = clean.slice(4, 6)
    const d = clean.slice(6, 8)
    return `${y}-${mo}-${d}T00:00:00`
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = getTripId(request)
  if (!tripId) return NextResponse.json({ error: 'No trip selected' }, { status: 400 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const groupId = formData.get('group_id') as string
  const eventType = (formData.get('event_type') as string) || 'optional'
  const preview = formData.get('preview') === 'true'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const events = parseICS(text)

  if (events.length === 0) {
    return NextResponse.json({ error: 'No events found in ICS file' }, { status: 400 })
  }

  if (preview) {
    return NextResponse.json({ count: events.length, preview: events.slice(0, 5) })
  }

  // Get participants in the selected group (or all if no group)
  let participantIds: string[] = []

  if (groupId) {
    const { data } = await supabaseAdmin
      .from('participants')
      .select('id')
      .eq('group_id', groupId)
      .eq('trip_id', tripId)
    participantIds = (data || []).map((p: any) => p.id)
  } else {
    const { data } = await supabaseAdmin
      .from('participants')
      .select('id')
      .eq('trip_id', tripId)
    participantIds = (data || []).map((p: any) => p.id)
  }

  const results = { created: 0, assigned: 0, errors: [] as string[] }

  for (const event of events) {
    try {
      const { data: created, error } = await supabaseAdmin
        .from('events')
        .insert([{
          title: event.title,
          description: event.description || null,
          location: event.location || null,
          start_time: event.start,
          end_time: event.end || event.start,
          type: eventType,
          trip_id: tripId,  // ← add this
        }])
        .select()
        .single()

      if (error) throw error
      results.created++

      if (participantIds.length > 0) {
        const joins = participantIds.map(pid => ({
          participant_id: pid,
          event_id: created.id,
        }))
        await supabaseAdmin.from('participant_events').insert(joins)
        results.assigned += participantIds.length
      }
    } catch (e: any) {
      results.errors.push(`${event.title}: ${e.message}`)
    }
  }

  return NextResponse.json(results)
}