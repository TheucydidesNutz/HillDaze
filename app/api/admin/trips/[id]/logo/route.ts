import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

async function getAdminUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // FIX: Verify user has access to this trip
  const { data: access } = await supabaseAdmin
    .from('trip_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('trip_id', id)
    .single()

  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP allowed' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const ext = file.type.split('/')[1]
  const filePath = `trips/${id}/logo.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('photos')
    .upload(filePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('photos')
    .getPublicUrl(filePath)

  await supabaseAdmin
    .from('trips')
    .update({ logo_url: publicUrl })
    .eq('id', id)

  return NextResponse.json({ url: publicUrl })
}
