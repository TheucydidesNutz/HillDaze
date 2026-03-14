import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_request: NextRequest) {
  // Get the most recent active map
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('doc_type', 'map')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return NextResponse.json({ map: null })
  return NextResponse.json({ map: data })
}