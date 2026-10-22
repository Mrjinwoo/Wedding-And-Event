import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mfaUnenrollSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'

// DELETE /api/auth/mfa/unenroll
// Removes a TOTP factor from the staff account (admin-only, requires aal2).
// Used from the admin settings page; NOT exposed to client/user accounts.
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = mfaUnenrollSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { factorId } = parsed.data
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Confirm this is an admin account
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only staff accounts can manage MFA factors.' },
        { status: 403 }
      )
    }

    // Require aal2 to unenroll (can't remove MFA without having passed MFA)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aalData?.currentLevel !== 'aal2') {
      return NextResponse.json(
        {
          error:
            'Step-up authentication required. Please verify your MFA code first.',
        },
        { status: 403 }
      )
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Clear recovery codes when factor is removed
    await supabase
      .from('profiles')
      .update({
        mfa_recovery_codes: [],
      })
      .eq('id', user.id)

    await logActivity({
      userId: user.id,
      action: 'MFA_UNENROLLED',
      entity: 'profiles',
      entityId: user.id,
      details: { factorId },
    }).catch(() => null)

    return NextResponse.json({
      message: 'Authenticator removed. You will be required to re-enroll on next login.',
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
