import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess, verifyResourceOwnership } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: groupId } = await params

  // FIX: Verify trip access and group ownership
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const owns = await verifyResourceOwnership('groups', groupId, access.tripId)
  if (!owns) return NextResponse.json({ error: 'Group not found in this trip' }, { status: 404 })

  const body = await request.json()

  // FIX: Explicitly pick allowed fields (strip id, trip_id)
  const { data, error } = await supabaseAdmin
  .from('groups')
  .update({
    name: body.name,
    lead_name: body.lead_name || null,
    lead_phone: body.lead_phone || null,
    lead_email: body.lead_email || null,
    lead_photo_url: body.lead_photo_url || null,
  })
  .eq('id', groupId)
  .eq('trip_id', access.tripId)
  .select()
  .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // FIX: Verify trip access and group ownership
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('groups')
    .delete()
    .eq('id', id)
    .eq('trip_id', access.tripId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}