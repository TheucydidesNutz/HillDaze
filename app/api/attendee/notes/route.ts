import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { token, content } = await request.json()

  if (!token || !content) {
    return NextResponse.json({ error: 'Token and content required' }, { status: 400 })
  }

  // Find participant by token
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('access_token', token)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('notes')
    .insert([{ participant_id: participant.id, content }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('access_token', token)
    .single()

  if (!participant) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('notes')
    .select('*')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}