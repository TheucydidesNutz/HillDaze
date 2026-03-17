import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch their latest settings
  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('display_name, phone, photo_url, company, role')
    .eq('user_id', user.id)
    .single()

  if (!settings) return NextResponse.json({ synced: 0 })

  // Find all participant records linked to this admin (matched by email)
  const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(user.id)
  const email = authUser?.email
  if (!email) return NextResponse.json({ synced: 0 })

  const { data: participants } = await supabaseAdmin
    .from('participants')
    .select('id, admin_overridden_fields')
    .eq('email', email)

  if (!participants || participants.length === 0) return NextResponse.json({ synced: 0 })

  let synced = 0
  for (const p of participants) {
    const overridden: Record<string, boolean> = (p.admin_overridden_fields as any) || {}

    const updates: Record<string, any> = {
      name: settings.display_name || email,
      updated_at: new Date().toISOString(),
    }
    if (!overridden.phone) updates.phone = settings.phone || '(123) 555-6789'
    if (!overridden.photo_url) updates.photo_url = settings.photo_url || null
    if (!overridden.company) updates.company = settings.company || null
    if (!overridden.title) updates.title = settings.role || null

    await supabaseAdmin
      .from('participants')
      .update(updates)
      .eq('id', p.id)

    synced++
  }

  return NextResponse.json({ synced })
}