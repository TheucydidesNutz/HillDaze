import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  // Allow both admin and attendee token access
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath) return NextResponse.json({ error: 'No path provided' }, { status: 400 })

  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}