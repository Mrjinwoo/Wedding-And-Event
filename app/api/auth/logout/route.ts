import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { LV_COOKIE_NAME, lvClearOptions } from '@/lib/supabase/lv'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await logActivity({
        userId:   user.id,
        action:   'USER_LOGOUT',
        entity:   'profiles',
        entityId: user.id,
      }).catch(() => null)
    }

    await supabase.auth.signOut({ scope: 'local' })

    const response = NextResponse.json({ message: 'Logged out successfully' })
    response.cookies.set(LV_COOKIE_NAME, '', lvClearOptions())
    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
