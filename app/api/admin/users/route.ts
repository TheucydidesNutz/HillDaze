import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // FIX: Only return users who share at least one trip with the requesting user.
  // Step 1: Get all trip_ids the current user is a member of
  const { data: myTrips } = await supabaseAdmin
    .from('trip_admins')
    .select('trip_id')
    .eq('user_id', user.id)

  if (!myTrips || myTrips.length === 0) {
    return NextResponse.json([])
  }

  const myTripIds = myTrips.map(t => t.trip_id)

  // Step 2: Get all user_ids who are members of those trips
  const { data: sharedAdmins } = await supabaseAdmin
    .from('trip_admins')
    .select('user_id, role')
    .in('trip_id', myTripIds)

  if (!sharedAdmins || sharedAdmins.length === 0) {
    return NextResponse.json([])
  }

  // Deduplicate user_ids
  const uniqueUserIds = [...new Set(sharedAdmins.map(a => a.user_id))]

  // Step 3: Get auth info only for those users
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // FIX: Filter to only users in shared trips
  const filteredUsers = users.filter(u => uniqueUserIds.includes(u.id))

  return NextResponse.json(filteredUsers.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  })))
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // FIX: Require trip context and verify trip access
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // FIX: Only super admins can change roles
  if (access.role !== 'super') {
    return NextResponse.json({ error: 'Only super admins can change roles' }, { status: 403 })
  }

  const { userId, role } = await request.json()
  if (!userId || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // FIX: Validate role is an allowed value
  if (!['super', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Must be "super" or "admin".' }, { status: 400 })
  }

  // FIX: Only update role for the specific trip, not all trips
  const { error } = await supabaseAdmin
    .from('trip_admins')
    .update({ role })
    .eq('user_id', userId)
    .eq('trip_id', access.tripId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // FIX: Require trip context and verify super admin access
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (access.role !== 'super') {
    return NextResponse.json({ error: 'Only super admins can remove users' }, { status: 403 })
  }

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // Prevent self-deletion
  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 403 })
  }

  // FIX: Only remove the user from THIS trip, not the entire system.
  // If you want to fully delete a user, that should be a separate,
  // more privileged operation (e.g., org-level admin panel).
  const { error } = await supabaseAdmin
    .from('trip_admins')
    .delete()
    .eq('user_id', userId)
    .eq('trip_id', access.tripId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
