import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const token = formData.get('token') as string
  const file = formData.get('file') as File

  if (!token || !file) {
    return NextResponse.json({ error: 'Token and file are required' }, { status: 400 })
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 })
  }

  // Authenticate via access token — trip_id comes from DB (trusted)
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, trip_id')
    .eq('access_token', token)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Build storage path: {trip_id}/{participant_id}/{timestamp}.{ext}
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const timestamp = Date.now()
  const path = `${participant.trip_id}/${participant.id}/${timestamp}.${ext}`

  // Upload to trip-photos bucket
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabaseAdmin.storage
    .from('trip-photos')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from('trip-photos')
    .getPublicUrl(path)

  return NextResponse.json({
    url: urlData.publicUrl,
    path,
  }, { status: 201 })
}
