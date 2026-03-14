import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

async function getAdminUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
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

  const { data: inviterAccess } = await supabaseAdmin
    .from('trip_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('trip_id', id)
    .single()

  if (inviterAccess?.role !== 'super') {
    return NextResponse.json({ error: 'Only super admins can invite others' }, { status: 403 })
  }

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const invitedUser = users.find((u: any) => u.email === email)

  if (!invitedUser) {
    const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

    await supabaseAdmin
      .from('trip_admins')
      .insert([{ trip_id: id, user_id: newUser.user.id, role: 'admin', invited_by: user.id }])

    return NextResponse.json({ message: `Invitation sent to ${email}` })
  }

  const { error } = await supabaseAdmin
    .from('trip_admins')
    .upsert([{ trip_id: id, user_id: invitedUser.id, role: 'admin', invited_by: user.id }],
      { onConflict: 'trip_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  return NextResponse.json(data)
}