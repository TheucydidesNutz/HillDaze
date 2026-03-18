import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Get participant and their trip
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, name, trip_id')
    .eq('access_token', token)
    .single()

  let tripTitle = 'HillDayTracker'

  if (participant?.trip_id) {
    const { data: trip } = await supabaseAdmin
      .from('trips')
      .select('title')
      .eq('id', participant.trip_id)
      .single()

    if (trip) {
      tripTitle = trip.title
    }
  }

  const manifest = {
    name: tripTitle,
    short_name: tripTitle,
    description: `Your personal information for ${tripTitle}`,
    start_url: `/attendee/${token}`,
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait',
    // Always use static same-origin icons for PWA install compatibility
    // (cross-origin Supabase URLs cause Android Chrome to silently reject the install prompt)
    // Trip logos and profile photos are displayed in <img> tags and work fine from Supabase URLs
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}