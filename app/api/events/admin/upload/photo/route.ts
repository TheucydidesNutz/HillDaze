import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, requireTripAccess } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // FIX: Verify trip access
  const access = await requireTripAccess(request, user.id)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const participantId = formData.get('participant_id') as string
  const groupId = formData.get('group_id') as string

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, and WebP allowed.' }, { status: 400 })
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
  }

  // FIX: Verify the participant/group belongs to this trip
  if (participantId) {
    const { data: p } = await supabaseAdmin
      .from('participants')
      .select('id')
      .eq('id', participantId)
      .eq('trip_id', access.tripId)
      .single()
    if (!p) return NextResponse.json({ error: 'Participant not found in this trip' }, { status: 404 })
  } else if (groupId) {
    const { data: g } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .eq('trip_id', access.tripId)
      .single()
    if (!g) return NextResponse.json({ error: 'Group not found in this trip' }, { status: 404 })
  } else {
    return NextResponse.json({ error: 'participant_id or group_id required' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const fileExt = file.type.split('/')[1]
  const folder = participantId ? `participants/${participantId}` : `groups/${groupId}`
  const filePath = `${folder}/avatar.${fileExt}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('photos')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('photos')
    .getPublicUrl(filePath)

  // Update the participant or group record
  if (participantId) {
    await supabaseAdmin
      .from('participants')
      .update({ photo_url: publicUrl })
      .eq('id', participantId)
      .eq('trip_id', access.tripId)
  } else if (groupId) {
    await supabaseAdmin
      .from('groups')
      .update({ lead_photo_url: publicUrl })
      .eq('id', groupId)
      .eq('trip_id', access.tripId)
  }

  return NextResponse.json({ url: publicUrl })
}
