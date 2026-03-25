import { NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: settings }, { data: tripAdminRows }] = await Promise.all([
    supabaseAdmin
      .from('user_settings')
      .select('subscription_tier, subscription_expires_at')
      .eq('user_id', user.id)
      .single(),
    supabaseAdmin
      .from('trip_admins')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'super'),
  ])

  return NextResponse.json({
    tier: settings?.subscription_tier || 'free',
    expiresAt: settings?.subscription_expires_at || null,
    tripCount: tripAdminRows?.length || 0,
  })
}