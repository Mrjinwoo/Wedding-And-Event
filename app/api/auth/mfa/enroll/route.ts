import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mfaEnrollConfirmSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import crypto from 'crypto'

// ─── GET /api/auth/mfa/enroll ─────────────────────────────────────────────────
// Step 1: Begin TOTP enrollment. Returns a QR code SVG URI and the factor ID.
// The client renders the QR, the staff member scans with their authenticator,
// then POSTs to confirm.
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin-role users may enroll
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only staff accounts can enroll in MFA.' },
        { status: 403 }
      )
    }

    // Reuse an existing verified authenticator instead of trying to create
    // another one. This also handles a factor whose friendly name has changed.
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) {
      return NextResponse.json({ error: factorsError.message }, { status: 400 })
    }
    const totpFactors = factors?.totp ?? []
    if (totpFactors.some(factor => factor.status === 'verified')) {
      return NextResponse.json({
        error: 'An authenticator is already enrolled. Verify its code to continue.',
        alreadyEnrolled: true,
      }, { status: 409 })
    }

    // Previous attempts can leave more than one pending TOTP factor. Remove
    // those incomplete factors only; never remove a verified factor here.
    for (const factor of totpFactors.filter(item => item.status !== 'verified')) {
      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (removeError) {
        console.error('[mfa/enroll] Failed to remove pending factor:', removeError.message)
        return NextResponse.json({
          error: 'A previous MFA setup is incomplete. Remove the pending authenticator in account security, then try again.',
        }, { status: 409 })
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      // A unique label avoids Supabase rejecting an enrollment while a deleted
      // factor name is still present in its schema cache.
      friendlyName: `Authenticator App ${crypto.randomBytes(3).toString('hex')}`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      factorId: data.id,
      qrCode: data.totp.qr_code,   // SVG data URI — render as <img src={qrCode}>
      secret: data.totp.secret,    // Manual entry fallback
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/auth/mfa/enroll ────────────────────────────────────────────────
// Step 2: Confirm enrollment. Client sends the factorId + a live TOTP code to
// prove the authenticator is set up. On success, 8 hashed recovery codes are
// generated and returned ONCE — staff must store them securely.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = mfaEnrollConfirmSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { factorId, code } = parsed.data
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create a challenge then immediately verify with the live code
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId })

    if (challengeError) {
      return NextResponse.json(
        { error: challengeError.message },
        { status: 400 }
      )
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    })

    if (verifyError) {
      const msg = verifyError.message.toLowerCase()
      if (msg.includes('invalid') || msg.includes('incorrect')) {
        return NextResponse.json(
          { error: 'Incorrect code. Check your authenticator and try again.' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: verifyError.message }, { status: 400 })
    }

    // Generate 8 single-use recovery codes (format: XXXX-XXXX-XXXX)
    const recoveryCodes = Array.from({ length: 8 }, () => {
      const segments = Array.from({ length: 3 }, () =>
        crypto.randomBytes(2).toString('hex').toUpperCase()
      )
      return segments.join('-')
    })

    // Store SHA-256 hashes in the profiles row (plaintext never persisted)
    const hashed = recoveryCodes.map(c =>
      crypto.createHash('sha256').update(c).digest('hex')
    )

    await supabase
      .from('profiles')
      .update({
        mfa_recovery_codes: hashed,
      })
      .eq('id', user.id)

    await logActivity({
      userId: user.id,
      action: 'MFA_ENROLLED',
      entity: 'profiles',
      entityId: user.id,
      details: { factorId },
    }).catch(() => null)

    return NextResponse.json({
      message: 'Authenticator enrolled successfully.',
      // Plaintext codes shown ONCE — client must display and staff must save them
      recoveryCodes,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
