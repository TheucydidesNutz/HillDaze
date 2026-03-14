import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  } else if (groupId) {
    await supabaseAdmin
      .from('groups')
      .update({ lead_photo_url: publicUrl })
      .eq('id', groupId)
  }

  return NextResponse.json({ url: publicUrl })
}