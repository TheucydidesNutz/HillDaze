import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, group_id, trip_id')
    .eq('access_token', token)
    .single()

  if (!participant) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('trip_id', participant.trip_id)
    .eq('doc_type', 'document')
    .or(`group_id.is.null${participant.group_id ? `,group_id.eq.${participant.group_id}` : ''}`)
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}