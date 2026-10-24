import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { forgotPasswordSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      // #6: return the same message regardless — don't leak whether the email
      // format was valid or not
      return NextResponse.json({
        message: 'If that email exists, a password reset link has been sent.',
      })
    }

    const { email } = parsed.data
    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=%2Freset-password`,
    })

    // Always return success to prevent email enumeration
    if (error) console.error('Reset password error:', error)

    return NextResponse.json({
      message: 'If that email exists, a password reset link has been sent.',
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
