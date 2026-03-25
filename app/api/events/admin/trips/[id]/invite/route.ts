import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'
import { canInviteAdmin } from '@/lib/events/limits'
import type { SubscriptionTier } from '@/lib/events/limits'

async function getAdminUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function upsertAdminAsParticipant(tripId: string, userId: string) {
  // Get user's auth info and settings
  const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (!authUser) return

  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('display_name, phone, photo_url, company, role')
    .eq('user_id', userId)
    .single()

  const name = settings?.display_name || authUser.email || ''
  const email = authUser.email || ''
  const phone = settings?.phone || '(123) 555-6789'

  // Upsert into participants — match on email + trip_id
  const { data: existing } = await supabaseAdmin
    .from('participants')
    .select('id, admin_overridden_fields')
    .eq('email', email)
    .eq('trip_id', tripId)
    .maybeSingle()

  if (existing) {
    const overridden: Record<string, boolean> = (existing.admin_overridden_fields as any) || {}
    // Only sync fields that haven't been manually overridden
    const updates: Record<string, any> = {
      name,
      updated_at: new Date().toISOString(),
    }
    if (!overridden.phone) updates.phone = phone
    if (!overridden.photo_url) updates.photo_url = settings?.photo_url || null
    if (!overridden.company) updates.company = settings?.company || null
    if (!overridden.title) updates.title = settings?.role || null

    await supabaseAdmin
      .from('participants')
      .update(updates)
      .eq('id', existing.id)
  } else {
    // Insert new participant — no overrides yet
    await supabaseAdmin
      .from('participants')
      .insert([{
        name,
        email,
        phone,
        photo_url: settings?.photo_url || null,
        company: settings?.company || null,
        title: settings?.role || null,
        trip_id: tripId,
      }])
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { email } = await request.json()

  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Check inviter is super admin on this trip
  const { data: inviterAccess } = await supabaseAdmin
    .from('trip_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('trip_id', id)
    .single()

  if (inviterAccess?.role !== 'super') {
    return NextResponse.json({ error: 'Only super admins can invite others' }, { status: 403 })
  }

  // Check subscription tier allows inviting admins
  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('subscription_tier')
    .eq('user_id', user.id)
    .single()

  const tier = (settings?.subscription_tier || 'free') as SubscriptionTier

  // Count current admins on this trip
  const { count: adminCount } = await supabaseAdmin
    .from('trip_admins')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', id)

  if (!canInviteAdmin(tier, adminCount || 0)) {
    return NextResponse.json({
      error: tier === 'free' || tier === 'basic'
        ? 'Your plan does not support multiple admins. Upgrade to Pro or Enterprise to invite collaborators.'
        : 'You have reached the maximum number of admins for your plan.',
      code: 'ADMIN_LIMIT_REACHED',
    }, { status: 403 })
  }

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const invitedUser = users.find((u: any) => u.email === email)

  if (!invitedUser) {
    const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

    await supabaseAdmin
      .from('trip_admins')
      .insert([{ trip_id: id, user_id: newUser.user.id, role: 'admin', invited_by: user.id }])

    // Add new user as participant
    await upsertAdminAsParticipant(id, newUser.user.id)

    return NextResponse.json({ message: `Invitation sent to ${email}` })
  }

  const { error } = await supabaseAdmin
    .from('trip_admins')
    .upsert([{ trip_id: id, user_id: invitedUser.id, role: 'admin', invited_by: user.id }],
      { onConflict: 'trip_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add existing user as participant
  await upsertAdminAsParticipant(id, invitedUser.id)

  return NextResponse.json({ message: `${email} added as admin` })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('trip_admins')
    .select('*')
    .eq('trip_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()

  const enriched = (data || []).map((admin: any) => {
    const authUser = users.find((u: any) => u.id === admin.user_id)
    return { ...admin, email: authUser?.email || admin.user_id }
  })

  return NextResponse.json(enriched)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data: requesterAccess } = await supabaseAdmin
    .from('trip_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('trip_id', id)
    .single()

  if (requesterAccess?.role !== 'super') {
    return NextResponse.json({ error: 'Only super admins can remove admins' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('trip_admins')
    .delete()
    .eq('trip_id', id)
    .eq('user_id', userId)
    .neq('role', 'super')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}