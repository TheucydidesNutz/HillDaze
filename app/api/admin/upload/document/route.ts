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
  if (!access) return NextResponse.json({ error: 'Forbidden — no access to this trip' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const label = formData.get('label') as string
  const docType = formData.get('doc_type') as string
  const groupId = formData.get('group_id') as string

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!label) return NextResponse.json({ error: 'Label required' }, { status: 400 })

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, JPG, PNG, WebP allowed' }, { status: 400 })
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Max 20MB' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const id = crypto.randomUUID()
  const ext = file.name.split('.').pop()
  const filePath = `${docType}s/${id}/file.${ext}`
  const fileType = file.type === 'application/pdf' ? 'pdf' : 'image'

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(filePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert([{
      label,
      file_url: filePath,
      file_type: fileType,
      doc_type: docType,
      group_id: groupId || null,
      trip_id: access.tripId,
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
