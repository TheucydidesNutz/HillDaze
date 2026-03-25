import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const token = formData.get('token') as string

  if (!file || !token) return NextResponse.json({ error: 'File and token required' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP allowed' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Max 5MB' }, { status: 400 })
  }

  // Find participant by token
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('access_token', token)
    .single()

  if (!participant) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const buffer = await file.arrayBuffer()
  const ext = file.type.split('/')[1]
  const filePath = `participants/${participant.id}/avatar.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('photos')
    .upload(filePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('photos')
    .getPublicUrl(filePath)

  await supabaseAdmin
    .from('participants')
    .update({ photo_url: publicUrl })
    .eq('id', participant.id)

  return NextResponse.json({ url: publicUrl })
}