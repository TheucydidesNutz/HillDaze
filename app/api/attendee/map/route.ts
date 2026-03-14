import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ map: null })

  // Get participant's trip_id
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('trip_id')
    .eq('access_token', token)
    .single()

  if (!participant) return NextResponse.json({ map: null })

  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('doc_type', 'map')
    .eq('trip_id', participant.trip_id)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ map: null })
  return NextResponse.json({ map: data })
}