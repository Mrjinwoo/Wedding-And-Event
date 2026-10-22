import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { LV_COOKIE_NAME, createLvValue, lvCookieOptions } from '@/lib/supabase/lv'
import { consumeStepToken, verifyStepToken } from '@/lib/step-token'

// POST /api/auth/verify-login-otp
// Body: { email, token, stepToken }
export async function POST(req: NextRequest) {
  try {
    const { email, token, stepToken } = await req.json()

    if (!email || !token || !stepToken) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Gate 1: stepToken proves /api/auth/login password check ran
    if (!verifyStepToken(stepToken, email)) {
      return NextResponse.json(
        { error: 'Session expired. Please start over.' },
        { status: 401 }
      )
    }

    // Gate 2: verify the OTP with Supabase
    const supabase = await createClient()
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (verifyError) {
      const msg = verifyError.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('otp has expired')) {
        return NextResponse.json(
          { error: 'This code has expired. Click Resend to get a new one.' },
          { status: 400 }
        )
      }
      if (msg.includes('invalid') || msg.includes('token not found')) {
        return NextResponse.json(
          { error: 'Incorrect code. Please check and try again.' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: 'Verification failed.' }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Verification failed.' }, { status: 400 })
    }

    if (!consumeStepToken(stepToken, email)) {
      await supabase.auth.signOut({ scope: 'local' })
      return NextResponse.json(
        { error: 'This login step was already used. Please sign in again.' },
        { status: 401 }
      )
    }

    // Fetch role for redirect decision
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    await logActivity({
      userId:   data.user.id,
      action:   'USER_LOGIN',
      entity:   'profiles',
      entityId: data.user.id,
      details:  { email },
    }).catch(() => null)

    const role = profile?.role ?? 'client'

    // Gate 3: stamp a signed HttpOnly cookie so proxy.ts can distinguish
    // a full password+OTP login from a raw verifyOtp bypass.
    // Value is HMAC-signed, bound to userId, and carries an expiry.
    const response = NextResponse.json({ role })
    response.cookies.set(
      LV_COOKIE_NAME,
      createLvValue(data.user.id),
      lvCookieOptions()
    )
    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
