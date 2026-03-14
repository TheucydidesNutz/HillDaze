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

  let query = supabaseAdmin
    .from('broadcasts')
    .select('*, group:groups(id, name)')
    .order('created_at', { ascending: false })

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
  const { message, sender_name, group_id } = body

  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
  if (!sender_name?.trim()) return NextResponse.json({ error: 'Sender name required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('broadcasts')
    .insert([{ message, sender_name, group_id: group_id || null, trip_id: tripId }])
    .select('*, group:groups(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  const { error } = await supabaseAdmin.from('broadcasts').delete().eq('id', id!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}