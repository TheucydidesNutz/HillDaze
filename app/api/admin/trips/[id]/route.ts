import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

async function getAdminUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// FIX: Verify user has access to this specific trip and return their role
async function verifyTripAccess(userId: string, tripId: string) {
  const { data } = await supabaseAdmin
    .from('trip_admins')
    .select('role')
    .eq('user_id', userId)
    .eq('trip_id', tripId)
    .single()
  return data
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // FIX: Verify the user has access to this trip
  const access = await verifyTripAccess(user.id, id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  // FIX: Explicitly pick allowed fields instead of spreading raw body
  const { data, error } = await supabaseAdmin
    .from('trips')
    .update({
      title: body.title,
      start_date: body.start_date,
      end_date: body.end_date,
      timezone: body.timezone,
      logo_url: body.logo_url,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify user is super admin on this trip
  const access = await verifyTripAccess(user.id, id)
  if (access?.role !== 'super') {
    return NextResponse.json({ error: 'Only super admins can delete trips' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('trips').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
