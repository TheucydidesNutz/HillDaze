import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createSupabaseServerClient, getTripId } from '@/lib/supabase'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = getTripId(request)
  if (!tripId) return NextResponse.json({ error: 'No trip selected' }, { status: 400 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const label = formData.get('label') as string

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 })

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files allowed.' }, { status: 400 })
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const id = crypto.randomUUID()
  const filePath = `factsheets/${id}/document.pdf`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // Set all existing fact sheets for this trip to inactive
  await supabaseAdmin
    .from('fact_sheets')
    .update({ is_active: false })
    .eq('trip_id', tripId)

  const { data, error } = await supabaseAdmin
    .from('fact_sheets')
    .insert([{ label, file_url: filePath, is_active: true, trip_id: tripId }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}