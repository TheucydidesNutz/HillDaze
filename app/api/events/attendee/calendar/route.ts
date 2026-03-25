import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Format a naive datetime string (from DB) into ICS DTSTART/DTEND format.
 * Events are stored as naive timestamps. We apply TZID at the property level.
 * Format: YYYYMMDDTHHMMSS
 */
function toICSDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

/**
 * Escape special characters in ICS text fields.
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Generate a UID for an ICS event.
 */
function generateUID(eventId: string): string {
  return `${eventId}@covaled.com`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  // Authenticate via access token — trip_id from DB (trusted)
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, trip_id')
    .eq('access_token', token)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Fetch trip details for title and timezone
  const { data: trip } = await supabaseAdmin
    .from('trips')
    .select('title, timezone')
    .eq('id', participant.trip_id)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Fetch all events for this trip
  const { data: events, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('trip_id', participant.trip_id)
    .order('start_time', { ascending: true })

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 })
  }

  const timezone = trip.timezone || 'America/New_York'
  const calendarName = escapeICS(trip.title || 'Trip Schedule')

  // Build ICS content
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Covaled//Trip Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    `X-WR-TIMEZONE:${timezone}`,
  ]

  for (const event of events || []) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${generateUID(event.id)}`)
    lines.push(`DTSTAMP:${toICSDateTime(new Date().toISOString())}Z`)
    lines.push(`DTSTART;TZID=${timezone}:${toICSDateTime(event.start_time)}`)
    lines.push(`DTEND;TZID=${timezone}:${toICSDateTime(event.end_time)}`)
    lines.push(`SUMMARY:${escapeICS(event.title)}`)

    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`)
    }
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`)
    }

    // Add type as a category
    if (event.type) {
      lines.push(`CATEGORIES:${event.type === 'mandatory' ? 'Mandatory' : 'Optional'}`)
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  const icsContent = lines.join('\r\n')

  // Sanitize filename
  const safeTitle = (trip.title || 'schedule')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeTitle}-schedule.ics"`,
    },
  })
}
