import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  // The callback must be reachable before a Supabase session exists. The
  // callback Route Handler exchanges the one-time code and writes session cookies.
  if (request.nextUrl.pathname === '/auth/callback') return NextResponse.next()
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public assets (svg, png, jpg, jpeg, gif, webp)
     *
     * This ensures /api routes are also covered by the session middleware.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
