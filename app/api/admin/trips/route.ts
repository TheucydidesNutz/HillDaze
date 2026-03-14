import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

async function getAdminUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('trip_admins')
    .select('role, trip:trips(*)')
    .eq('user_id', user.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const trips = data.map((row: any) => ({ ...row.trip, role: row.role }))
  return NextResponse.json(trips)
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, start_date, end_date } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const { data: trip, error } = await supabaseAdmin
    .from('trips')
    .insert([{ title, start_date: start_date || null, end_date: end_date || null, created_by: user.id }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin
    .from('trip_admins')
    .insert([{ trip_id: trip.id, user_id: user.id, role: 'super', invited_by: user.id }])

  return NextResponse.json({ ...trip, role: 'super' }, { status: 201 })
}