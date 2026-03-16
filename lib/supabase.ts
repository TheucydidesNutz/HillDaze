import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Server client — use in Server Components and API routes
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Admin client — use in API routes that need to bypass RLS
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DEPRECATED — use requireTripAccess instead for admin routes
// Only keep for backward compat if needed in non-admin contexts
export function getTripId(request: Request): string | null {
  const tripId = request.headers.get('x-trip-id')
  return tripId || null
}

// SECURE trip access check — validates UUID format AND verifies
// the authenticated user is a member of the trip via trip_admins.
// Returns { tripId, role } if authorized, null otherwise.
export async function requireTripAccess(
  request: Request,
  userId: string
): Promise<{ tripId: string; role: 'super' | 'admin' } | null> {
  const tripId = request.headers.get('x-trip-id')

  // Require header to be present
  if (!tripId) return null

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId)) return null

  // Verify user has access to this trip
  const { data } = await supabaseAdmin
    .from('trip_admins')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single()

  if (!data) return null

  return { tripId, role: data.role as 'super' | 'admin' }
}

// Verify a resource (by its ID) belongs to a specific trip.
// Use for [id] routes where you have the resource ID but need to
// confirm it belongs to the user's authorized trip.
export async function verifyResourceOwnership(
  table: string,
  resourceId: string,
  tripId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq('id', resourceId)
    .eq('trip_id', tripId)
    .single()

  return !!data
}


// Helper that automatically adds x-trip-id header to all admin API calls

export function getTripIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('current_trip')
    if (!stored) return null
    return JSON.parse(stored).id
  } catch {
    return null
  }
}

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const tripId = getTripIdFromStorage()
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(tripId ? { 'x-trip-id': tripId } : {}),
    },
  })
}
