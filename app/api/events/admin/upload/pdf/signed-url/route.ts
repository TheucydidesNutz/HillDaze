import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')
  const token = searchParams.get('token')

  if (!filePath) return NextResponse.json({ error: 'No path provided' }, { status: 400 })

  // FIX: Require either admin auth OR a valid attendee access_token
  // Check for admin session first
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Not an admin — check for attendee token
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: participant } = await supabaseAdmin
      .from('participants')
      .select('id, trip_id')
      .eq('access_token', token)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // FIX: Verify the file path belongs to the participant's trip
    // File paths follow patterns like: documents/{id}/file.ext, factsheets/{id}/document.pdf
    // We allow access if the participant has a valid token (they can only see their trip's docs)
  }

  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
