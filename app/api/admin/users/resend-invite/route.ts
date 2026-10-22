import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/requireUser'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { userId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Select a staff account to resend.' }, { status: 400 })
  }

  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: 'Select a valid staff account.' }, { status: 400 })
  }

  try {
    const admin = createServiceClient()
    const [{ data: userResult, error: userError }, { data: profile, error: profileError }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from('profiles').select('role, is_active, full_name').eq('id', userId).maybeSingle(),
    ])

    if (userError || !userResult.user) {
      return NextResponse.json({ error: 'Staff account not found.' }, { status: 404 })
    }
    if (profileError || !profile || profile.role !== 'staff') {
      return NextResponse.json({ error: 'Only staff accounts can receive a staff invitation.' }, { status: 404 })
    }
    if (!profile.is_active) {
      return NextResponse.json({ error: 'This staff account is inactive. Activate it before resending an invitation.' }, { status: 409 })
    }
    if (!userResult.user.email) {
      return NextResponse.json({ error: 'This staff account has no email address.' }, { status: 422 })
    }

    const origin = new URL(req.url).origin
    const isConfirmed = Boolean(userResult.user.email_confirmed_at)
    let error: { message: string } | null = null

    if (isConfirmed) {
      // Confirmed accounts cannot receive another invite. Send a password setup/reset link instead.
      const result = await admin.auth.resetPasswordForEmail(userResult.user.email, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      })
      error = result.error
    } else {
      const result = await admin.auth.admin.inviteUserByEmail(userResult.user.email, {
        data: { full_name: profile.full_name, role: 'staff' },
        redirectTo: `${origin}/auth/callback?next=/set-password`,
      })
      error = result.error

      // If the account became confirmed since lookup, switch to a recovery link.
      if (error && /already|confirmed|email_exists/i.test(error.message)) {
        const recovery = await admin.auth.resetPasswordForEmail(userResult.user.email, {
          redirectTo: `${origin}/auth/callback?next=/reset-password`,
        })
        if (!recovery.error) {
          error = null
        } else {
          error = recovery.error
        }
      }
    }

    if (error) {
      console.error('[admin/users] Staff invitation resend failed:', error.message)
      const message = error.message.toLowerCase()
      if (message.includes('invalid api key') || message.includes('service role')) {
        return NextResponse.json({ error: 'Supabase rejected the server key. Check the server key configuration.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Could not resend the invitation. Check Supabase Auth email delivery settings and try again.' }, { status: 502 })
    }

    await logActivity({
      userId: auth.user.id,
      action: isConfirmed ? 'ADMIN_RESEND_STAFF_SETUP_LINK' : 'ADMIN_RESEND_STAFF_INVITE',
      entity: 'profiles',
      entityId: userId,
      details: { role: 'staff' },
    }).catch(() => null)

    return NextResponse.json({
      message: isConfirmed
        ? `A fresh password setup link was sent to ${userResult.user.email}.`
        : `A new staff invitation was sent to ${userResult.user.email}.`,
    })
  } catch (error) {
    console.error('[admin/users] Staff invitation resend setup failed:', error)
    return NextResponse.json({ error: 'Could not resend the invitation. Check the Supabase server key and Auth email settings.' }, { status: 503 })
  }
}
