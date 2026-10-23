import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options'
import {
  LV_COOKIE_NAME,
  COOKIE_TTL_SECONDS,
  createLvValue,
  verifyLvValue,
  lvSecondsRemaining,
  lvCookieOptions,
  lvClearOptions,
} from '@/lib/supabase/lv'

// ── Helpers ───────────────────────────────────────────────────────────────────
function apiUnauthorized(res: NextResponse, msg = 'Unauthorized') {
  const r = NextResponse.json({ error: msg }, { status: 401 })
  r.cookies.set(LV_COOKIE_NAME, '', lvClearOptions())
  return r
}

function apiForbidden(msg = 'Forbidden') {
  return NextResponse.json({ error: msg }, { status: 403 })
}

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return NextResponse.redirect(url)
}

// ── Route categories ──────────────────────────────────────────────────────────
// Any route under these prefixes requires a valid lv cookie + Supabase session.
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/api/bookings',
  '/api/messages',
  '/api/notifications',
  '/api/activity',
  '/api/admin',
  '/api/reports',
]

// Require staff or admin role (AAL2 enforced separately below)
const STAFF_PREFIXES = ['/admin', '/api/admin', '/api/reports']

// These /admin/* pages are reachable at AAL1 (they ARE the MFA flow).
// They still require lv + getUser() — just not AAL2.
const MFA_EXEMPT_PAGES = [
  '/admin/mfa/enroll',
  '/admin/mfa/challenge',
]

// Auth pages: redirect logged-in users away
// Keep reset-password reachable even for an existing session. A signed-in
// admin may be resetting their password and must not be redirected to /admin.
const AUTH_PAGES = ['/login', '/signup', '/forgot-password']

// ── Main middleware ───────────────────────────────────────────────────────────
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
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

  // ── 1. Authoritative user check (never getSession) ───────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isApiRoute     = path.startsWith('/api/')
  const isAuthApiRoute = path.startsWith('/api/auth/')
  const isProtected    = PROTECTED_PREFIXES.some(p => path.startsWith(p))

  // ── 2. Not logged in → 401 / login redirect ──────────────────────────────────
  if (!user && isProtected) {
    if (isApiRoute) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return redirectTo(request, '/login', { redirect: path })
  }

  // ── 3. lv cookie check (skip for auth API routes — they issue the cookie) ────
  if (user && isProtected && !isAuthApiRoute) {
    const raw      = request.cookies.get(LV_COOKIE_NAME)?.value
    const cookieUid = verifyLvValue(raw)

    if (cookieUid !== user.id) {
      await supabase.auth.signOut()
      if (isApiRoute) return apiUnauthorized(NextResponse.json({}))
      const r = redirectTo(request, '/login')
      r.cookies.set(LV_COOKIE_NAME, '', lvClearOptions())
      return r
    }

    // ── 4. Sliding lv renewal ─────────────────────────────────────────────────
    const secondsLeft = lvSecondsRemaining(raw)
    if (secondsLeft < COOKIE_TTL_SECONDS / 2) {
      supabaseResponse.cookies.set(LV_COOKIE_NAME, createLvValue(user.id), lvCookieOptions())
    }
  }

  // ── 5. Redirect logged-in users away from auth pages ─────────────────────────
  if (user && AUTH_PAGES.some(p => path === p)) {
    const raw = request.cookies.get(LV_COOKIE_NAME)?.value
    if (verifyLvValue(raw) === user.id) {
      // Read role so admins go to /admin, clients go to /
      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const dest = (prof?.role === 'admin' || prof?.role === 'staff') ? '/admin' : '/'
      return redirectTo(request, dest)
    }
  }

  // ── 6. Staff/admin routes: role + AAL2 ──────────────────────────────────────
  if (user && STAFF_PREFIXES.some(p => path.startsWith(p))) {
    // 6a. Fetch role from profiles (not user_metadata)
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    const role    = profile?.role ?? 'client'
    const isStaff = role === 'admin' || role === 'staff'

    if (!isStaff) {
      return isApiRoute ? apiForbidden() : redirectTo(request, '/dashboard')
    }

    // MFA pages: lv + role already checked above; AAL2 not required here
    const isMfaPage = MFA_EXEMPT_PAGES.some(p => path.startsWith(p))
    if (isMfaPage) return supabaseResponse

    // 6b. Check MFA factors — if none enrolled, skip AAL2 requirement
    // This allows admin/staff to access the dashboard without TOTP when
    // no factor has been set up yet (graceful degradation for new accounts)
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const hasVerifiedFactor = (factors?.totp ?? []).some(f => f.status === 'verified')

    if (!hasVerifiedFactor) {
      // No factor enrolled — let them through to the dashboard
      // They will see the enroll prompt there instead of being hard-blocked
      return supabaseResponse
    }

    // 6c. Factor enrolled — check AAL level
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const currentLevel = aalData?.currentLevel ?? 'aal1'
    const nextLevel    = aalData?.nextLevel    ?? 'aal1'

    const needsChallenge = nextLevel === 'aal2' && currentLevel !== 'aal2'

    if (needsChallenge) {
      if (isApiRoute) return apiForbidden('AAL2 required')
      return redirectTo(request, '/admin/mfa/challenge', { next: path })
    }
  }

  return supabaseResponse
}
