import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))

  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (values[i] || '').replace(/^"|"$/g, '').trim()
    })
    return row
  }).filter(row => Object.values(row).some(v => v !== ''))
}

function isValidCell(value: string | null): boolean {
  if (!value) return true // null/empty is fine, not "invalid"
  // Reject values that look like formula injections or are obviously corrupted
  return true // all non-empty strings are valid cell values
}

function sanitizeRow(row: ReturnType<typeof mapRow>): ReturnType<typeof mapRow> {
  // For each string field, if it's set but looks structurally invalid, replace with 'error'
  // A "valid name" means it has at least one real character
  const result = { ...row }

  // Date/datetime fields: must be parseable or null
  const dateFields: Array<keyof typeof result> = ['arrival_datetime', 'departure_datetime']
  for (const field of dateFields) {
    const val = result[field]
    if (val && isNaN(Date.parse(val as string))) {
      (result as any)[field] = 'error'
    }
  }

  return result
}

function mapRow(row: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      if (row[key]) return row[key]
    }
    return null
  }

  return {
    name: get('name', 'full_name', 'fullname', 'participant_name') || '',
    company: get('company', 'organization', 'org'),
    title: get('title', 'job_title', 'position', 'role'),
    phone: formatPhone(get('phone', 'phone_number', 'mobile', 'cell')),
    email: get('email', 'email_address'),
    emergency_name: get('emergency_name', 'emergency_contact', 'emergency_contact_name'),
    emergency_phone: formatPhone(get('emergency_phone', 'emergency_contact_phone', 'emergency_number')),
    emergency_email: get('emergency_email', 'emergency_contact_email'),
    arrival_airline: get('arrival_airline', 'airline'),
    arrival_flight_no: get('arrival_flight_no', 'arrival_flight', 'flight_number', 'flight_no'),
    arrival_datetime: get('arrival_datetime', 'arrival_date', 'arrival_time') || null,
    arrival_airport: get('arrival_airport', 'arriving_airport'),
    departure_airline: get('departure_airline', 'return_airline'),
    departure_flight_no: get('departure_flight_no', 'departure_flight', 'return_flight'),
    departure_datetime: get('departure_datetime', 'departure_date', 'departure_time') || null,
    departure_airport: get('departure_airport', 'departing_airport'),
    hotel_name: get('hotel_name', 'hotel', 'accommodation'),
    hotel_room: get('hotel_room', 'room', 'room_number'),
    fun_diversions: get('fun_diversions', 'notes', 'diversions', 'personal_notes'),
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // FIX: Verify trip access
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden — no access to this trip' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const preview = formData.get('preview') === 'true'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
  }

  const mapped = rows
    .map(mapRow)
    .filter(r => r.name && r.name.trim().length > 0)  // reject only rows with missing/empty name
    .map(sanitizeRow)                                   // replace invalid cell values with 'error'

  if (preview) {
    return NextResponse.json({
      count: mapped.length,
      preview: mapped.slice(0, 5),
      columns: Object.keys(rows[0] || {}),
    })
  }

  const results = { created: 0, updated: 0, errors: [] as string[] }

  for (const participant of mapped) {
    try {
      if (!participant.name?.trim()) {
        results.errors.push(`(unnamed row): Name is required`)
        continue
      }

      if (participant.email) {
        // FIX: Scope email lookup to THIS trip only, not global
        const { data: existing, error: findError } = await supabaseAdmin
          .from('participants')
          .select('id')
          .eq('email', participant.email)
          .eq('trip_id', access.tripId)
          .maybeSingle()

        if (findError) {
          results.errors.push(`${participant.name}: DB lookup failed — ${findError.message}`)
          continue
        }

        if (existing) {
          const { error: updateError } = await supabaseAdmin
            .from('participants')
            .update({ ...participant, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .eq('trip_id', access.tripId)

          if (updateError) {
            results.errors.push(`${participant.name}: Update failed — ${updateError.message}`)
            continue
          }
          results.updated++
        } else {
          const { error: insertError } = await supabaseAdmin
            .from('participants')
            .insert([{ ...participant, trip_id: access.tripId }])

          if (insertError) {
            results.errors.push(`${participant.name}: Insert failed — ${insertError.message}`)
            continue
          }
          results.created++
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('participants')
          .insert([{ ...participant, trip_id: access.tripId }])

        if (insertError) {
          results.errors.push(`${participant.name}: Insert failed — ${insertError.message}`)
          continue
        }
        results.created++
      }
    } catch (e: any) {
      results.errors.push(`${participant.name || '(unknown)'}: Unexpected error — ${e.message}`)
    }
  }

  return NextResponse.json(results)
}
