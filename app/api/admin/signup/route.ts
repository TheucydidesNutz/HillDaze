import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { userId, orgName } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('user_settings')
    .upsert({
      user_id: userId,
      org_name: orgName?.trim() || null,
      subscription_tier: 'free',
      subscription_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}