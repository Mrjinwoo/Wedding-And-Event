import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { createStepToken } from '@/lib/step-token'
import { consumeLoginAttempt, getLoginClientIp } from '@/lib/auth/login-rate-limit'

// POST /api/auth/login
// Step 1 of 2: verify email + password.
// On success: signs them out, sends OTP, returns a short-lived stepToken
// that /api/auth/verify-login-otp will require before calling verifyOtp.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data
    const rateLimit = consumeLoginAttempt(getLoginClientIp(req.headers), email)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const supabase = await createClient()

    // ── 1. Verify password ───────────────────────────────────────────────────
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      // #6: one generic message — no leaking which field was wrong
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // ── 2. Check account active ──────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', data.user.id)
      .single()

    if (profile?.is_active === false) {
      await supabase.auth.signOut({ scope: 'local' })
      return NextResponse.json(
        { error: 'Your account has been deactivated. Contact admin.' },
        { status: 403 }
      )
    }

    // ── 3. Sign out — OTP is the real session gate ───────────────────────────
    await supabase.auth.signOut({ scope: 'local' })

    // ── 4. Send OTP ──────────────────────────────────────────────────────────
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    if (otpError) {
      console.error('[login] signInWithOtp error:', {
        message: otpError.message,
        status: otpError.status,
        code: otpError.code,
      })
      const message = otpError.message.toLowerCase()
      if (message.includes('rate limit') || message.includes('too many') || otpError.status === 429) {
        return NextResponse.json(
          { error: 'Too many codes were requested. Please wait 60 seconds, then try again.' },
          { status: 429, headers: { 'Retry-After': '60' } }
        )
      }

      if (
        message.includes('smtp') ||
        message.includes('email provider') ||
        message.includes('email address not authorized') ||
        message.includes('error sending') ||
        (otpError.status ?? 0) >= 500
      ) {
        return NextResponse.json(
          { error: 'Supabase could not deliver the email. Check the project’s Auth SMTP settings and email template.' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: `Could not send verification code: ${otpError.message}` },
        { status: 502 }
      )
    }

    await logActivity({
      userId: data.user.id,
      action: 'USER_LOGIN_OTP_SENT',
      entity: 'profiles',
      entityId: data.user.id,
      details: { email },
    }).catch(() => null)

    // ── 5. Issue step token proving password was checked ─────────────────────
    const stepToken = createStepToken(email)

    return NextResponse.json({ otpSent: true, stepToken })
  } 
  } catch (error) {
    console.error('[login] Unexpected error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }

}
