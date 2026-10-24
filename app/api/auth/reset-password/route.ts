import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resetPasswordSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { LV_COOKIE_NAME, lvClearOptions } from '@/lib/supabase/lv'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = resetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { password } = parsed.data
    const supabase = await createClient()

    // The email link is verified in /auth/callback, which establishes this
    // Supabase session. Require an authenticated session before updating.
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // The amr claim is in the access_token payload — not on the User object.
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logActivity({
      userId: user.id,
      action: 'PASSWORD_RESET',
      entity: 'profiles',
      entityId: user.id,
    }).catch(() => null)

    // End this browser's recovery session and require a fresh login here.
    // A global sign-out revokes refresh tokens on other tabs/devices too,
    // which causes those sessions to emit refresh_token_not_found errors.
    await supabase.auth.signOut({ scope: 'local' })

    const response = NextResponse.json({ message: 'Password updated successfully.' })
    response.cookies.set(LV_COOKIE_NAME, '', lvClearOptions())
    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
