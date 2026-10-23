import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options'

function safeNext(raw: string | null, fallback: string) {
  return raw?.startsWith('/') && !raw.startsWith('//') ? raw : fallback
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const type = url.searchParams.get('type')
  const fallback = type === 'recovery' ? '/reset-password' : type === 'invite' ? '/set-password' : '/'
  const next = safeNext(url.searchParams.get('next'), fallback)
  const cookieChanges: Array<{
    name: string
    value: string
    options: CookieOptions
  }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            cookieChanges.push({ name, value, options })
          })
        },
      },
    },
  )

  let authError: { message: string } | null = null
  const tokenHash = url.searchParams.get('token_hash')
  const code = url.searchParams.get('code')

  if (url.searchParams.has('error')) {
    authError = { message: 'The email link is invalid or expired.' }
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    authError = result.error
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code)
    authError = result.error
  } else {
    authError = { message: 'The email link did not contain a verification token.' }
  }

  const destination = authError
    ? new URL('/auth/callback?error=verification_failed', request.url)
    : new URL(next, request.url)
  const response = NextResponse.redirect(destination)
  cookieChanges.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
}
