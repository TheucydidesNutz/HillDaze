import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgName, displayName, phone, company, role, photoUrl } = await request.json()

  const { error } = await supabaseAdmin
    .from('user_settings')
    .upsert({
      user_id: user.id,
      org_name: orgName?.trim() || null,
      display_name: displayName?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      role: role?.trim() || null,
      photo_url: photoUrl || null,
      subscription_tier: 'free',
      subscription_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}