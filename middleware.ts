import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Hub page
  if (request.nextUrl.pathname === '/home' && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/events/admin/login'
    return NextResponse.redirect(url)
  }

  // Events admin routes
  if (
    request.nextUrl.pathname.startsWith('/events/admin') &&
    !request.nextUrl.pathname.startsWith('/events/admin/login') &&
    !request.nextUrl.pathname.startsWith('/events/admin/signup') &&
    !user
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/events/admin/login'
    return NextResponse.redirect(url)
  }

  if (request.nextUrl.pathname === '/events/admin/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  // Intel routes — protect everything except /intel (landing) and /intel/login
  if (
    request.nextUrl.pathname.startsWith('/intel/') &&
    request.nextUrl.pathname !== '/intel' &&
    !request.nextUrl.pathname.startsWith('/intel/login') &&
    !user
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/intel/login'
    return NextResponse.redirect(url)
  }

  // Analysis routes — protect everything except /analysis (landing) and /analysis/login
  if (
    request.nextUrl.pathname.startsWith('/analysis/') &&
    request.nextUrl.pathname !== '/analysis' &&
    !request.nextUrl.pathname.startsWith('/analysis/login') &&
    !user
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/analysis/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/home', '/events/:path*', '/intel/:path*', '/api/intel/:path*', '/analysis/:path*', '/api/analysis/:path*', '/api/shared/:path*', '/api/workspaces/:path*'],
}
