import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'
import { LV_COOKIE_NAME, createLvValue, lvCookieOptions } from '@/lib/supabase/lv'

// Point 2: type is hardcoded to 'signup' — never read from the request.
// This route is only for post-registration email confirmation.
// The /book/verify gate and any other use-case should call verifyOtp directly
// or use a separate route.

const schema = z.object({
  email: z.string().email(),
  token: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
})

// How recent the email_confirmed_at timestamp must be (seconds).
// Guards against replaying a valid session to issue a fresh lv cookie.
const MAX_CONFIRMATION_AGE_SECONDS = 5 * 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, token } = parsed.data
    const supabase = await createClient()

    // type is always 'signup' — never trusted from the client
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('otp has expired')) {
        return NextResponse.json(
          { error: 'This code has expired. Please request a new one.' },
          { status: 400 }
        )
      }
      if (
        msg.includes('invalid') ||
        msg.includes('incorrect') ||
        msg.includes('token not found')
      ) {
        return NextResponse.json(
          { error: 'Incorrect code. Please check and try again.' },
          { status: 400 }
        )
      }
      if (msg.includes('rate limit') || error.status === 429) {
        return NextResponse.json(
          { error: 'Too many attempts. Please wait before trying again.' },
          { status: 429 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Verification failed. Please try again.' },
        { status: 400 }
      )
    }

    // Activate profile row
    await supabase
      .from('profiles')
      .update({ is_active: true })
      .eq('id', data.user.id)

    await logActivity({
      userId:   data.user.id,
      action:   'EMAIL_VERIFIED',
      entity:   'profiles',
      entityId: data.user.id,
      details:  { email },
    }).catch(() => null)

    const response = NextResponse.json({
      message: 'Email verified successfully.',
      user: { id: data.user.id, email: data.user.email },
    })

    // Point 2: only issue lv if the email was confirmed in the last 5 minutes.
    // Supabase sets email_confirmed_at when verifyOtp succeeds.  If it is older
    // than MAX_CONFIRMATION_AGE_SECONDS the user is replaying an already-used
    // verification (e.g. clicking the OTP page again on an old tab), and we
    // should not issue a fresh lv cookie for that.
    const confirmedAt = data.user.email_confirmed_at
    if (confirmedAt) {
      const ageSeconds =
        Math.floor(Date.now() / 1000) -
        Math.floor(new Date(confirmedAt).getTime() / 1000)

      if (ageSeconds <= MAX_CONFIRMATION_AGE_SECONDS) {
        response.cookies.set(
          LV_COOKIE_NAME,
          createLvValue(data.user.id),
          lvCookieOptions()
        )
      }
    }

    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
