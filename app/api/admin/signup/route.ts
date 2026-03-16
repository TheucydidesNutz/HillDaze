import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // FIX: Verify the caller is authenticated and can only set up their own account
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgName } = await request.json()

  // FIX: Use the authenticated user's ID, not a client-supplied one
  const { error } = await supabaseAdmin
    .from('user_settings')
    .upsert({
      user_id: user.id,
      org_name: orgName?.trim() || null,
      subscription_tier: 'free',
      subscription_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
