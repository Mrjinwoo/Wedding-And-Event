import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mfaRecoverySchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import crypto from 'crypto'

// POST /api/auth/mfa/recovery
// Allows a staff member to use one of their 8 hashed recovery codes when they
// have lost access to their authenticator app.
//
// Flow:
//   1. Verify the code against the stored SHA-256 hashes in profiles.mfa_recovery_codes
//   2. Remove the used code (single-use)
//   3. Unenroll all TOTP factors so the staff member can re-enroll fresh
//   4. Return success — the login page then redirects to /admin/mfa/enroll
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = mfaRecoverySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { code } = parsed.data
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch stored hashes
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('mfa_recovery_codes, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Recovery codes are only available to staff accounts.' },
        { status: 403 }
      )
    }

    const storedHashes: string[] = profile.mfa_recovery_codes ?? []
    if (storedHashes.length === 0) {
      return NextResponse.json(
        {
          error:
            'No recovery codes found. Please contact your administrator.',
        },
        { status: 400 }
      )
    }

    const normalised = code.trim().toUpperCase()
    const hash = crypto
      .createHash('sha256')
      .update(normalised)
      .digest('hex')

    const matchIndex = storedHashes.indexOf(hash)
    if (matchIndex === -1) {
      return NextResponse.json(
        { error: 'Invalid recovery code.' },
        { status: 400 }
      )
    }

    // Remove the used code (single-use)
    const remaining = storedHashes.filter((_, i) => i !== matchIndex)
    await supabase
      .from('profiles')
      .update({
        mfa_recovery_codes: remaining,
      })
      .eq('id', user.id)

    // Unenroll all TOTP factors so the user can re-enroll
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totpFactors = factors?.totp ?? []

    await Promise.all(
      totpFactors.map(f =>
        supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => null)
      )
    )

    await logActivity({
      userId: user.id,
      action: 'MFA_RECOVERY_USED',
      entity: 'profiles',
      entityId: user.id,
      details: { codesRemaining: remaining.length },
    }).catch(() => null)

    return NextResponse.json({
      message:
        'Recovery code accepted. Your authenticator has been removed — please re-enroll.',
      codesRemaining: remaining.length,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
