import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resetPasswordSchema } from '@/lib/validation'
import { LV_COOKIE_NAME, lvClearOptions } from '@/lib/supabase/lv'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Enter and confirm a valid password.' }, { status: 400 })
  }

  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Your invitation link has expired. Ask an admin to send another one.' }, { status: 401 })

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // End only the current browser's setup session; global sign-out revokes
  // refresh tokens on other tabs/devices and makes them log refresh errors.
  await supabase.auth.signOut({ scope: 'local' })
  const response = NextResponse.json({ message: 'Password created. Please log in.' })
  response.cookies.set(LV_COOKIE_NAME, '', lvClearOptions())
  return response
}
