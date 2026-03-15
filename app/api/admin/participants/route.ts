import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, getTripId } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = getTripId(request)

  let query = supabaseAdmin
    .from('participants')
    .select('*, group:groups(*)')
    .order('name')

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

  const { data, error } = await supabaseAdmin
    .from('participants')
    .insert([{
      ...body,
      phone: formatPhone(body.phone),
      emergency_phone: formatPhone(body.emergency_phone),
      trip_id: tripId
    }])
    .select('*, group:groups(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}