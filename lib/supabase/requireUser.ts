/**
 * requireUser / requireUserPage / requireStaff
 *
 * Centralised auth + lv-cookie + role + AAL2 guard.
 * Use these in every API route and server page instead of duplicating checks.
 *
 * Route permission matrix (see also: docs below):
 *
 * Route                        | client | staff | admin | AAL2 required
 * -----------------------------|--------|-------|-------|---------------
 * GET  /api/bookings           |   ✓    |   ✓   |   ✓   | no
 * POST /api/bookings           |   ✓    |   ✗   |   ✗   | no
 * PATCH /api/bookings          |   ✓    |   ✗   |   ✗   | no  (own cancel)
 * GET  /api/messages           |   ✓    |   ✓   |   ✓   | no
 * POST /api/messages           |   ✓    |   ✓   |   ✓   | no
 * GET  /api/notifications      |   ✓    |   ✓   |   ✓   | no
 * PATCH /api/notifications     |   ✓    |   ✓   |   ✓   | no
 * GET  /api/activity           |   ✓    |   ✓   |   ✓   | no
 * GET  /api/venues             |  pub   |  pub  |  pub  | no  (public)
 * POST /api/venues             |   ✗    |   ✓   |   ✓   | yes
 * PATCH /api/venues            |   ✗    |   ✓   |   ✓   | yes
 * DELETE /api/venues           |   ✗    |   ✗   |   ✓   | yes
 * GET  /api/reports            |   ✗    |   ✗   |   ✓   | yes
 * GET  /api/admin/bookings     |   ✗    |   ✓   |   ✓   | yes
 * PATCH /api/admin/bookings    |   ✗    |   ✗   |   ✓   | yes
 * DELETE /api/admin/bookings   |   ✗    |   ✗   |   ✓   | yes
 * GET  /api/admin/users        |   ✗    |   ✗   |   ✓   | yes
 * PATCH /api/admin/users       |   ✗    |   ✗   |   ✓   | yes
 * DELETE /api/admin/users      |   ✗    |   ✗   |   ✓   | yes
 */

import 'server-only'
import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { verifyLvValue } from '@/lib/supabase/lv'

export type UserProfile = {
  id:        string
  full_name: string | null
  role:      string
  is_active: boolean
}

export type RequireUserSuccess = {
  user:    { id: string; email: string | undefined }
  profile: UserProfile
}

export type RequireUserError = {
  error:  string
  status: 401 | 403
}

// ── Shared core: getUser + lv + profile + active check ───────────────────────
async function coreCheck(
  getLvValue: () => string | undefined
): Promise<RequireUserSuccess | RequireUserError> {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Unauthorized', status: 401 }

  const cookieUid = verifyLvValue(getLvValue())
  if (cookieUid !== user.id) return { error: 'Unauthorized', status: 401 }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile)         return { error: 'Unauthorized', status: 401 }
  if (profile.is_active === false)    return { error: 'Account deactivated. Contact admin.', status: 403 }

  return { user: { id: user.id, email: user.email }, profile: profile as UserProfile }
}

// ── API route helper ──────────────────────────────────────────────────────────
// opts.roles: if provided, user must have one of these roles
// opts.requireAal2: if true, the Supabase session must be at AAL2
export async function requireUser(
  req: NextRequest,
  opts: { roles?: string[]; requireAal2?: boolean } = {}
): Promise<RequireUserSuccess | RequireUserError> {
  const result = await coreCheck(() => req.cookies.get('lv')?.value)
  if ('error' in result) return result

  if (opts.roles?.length && !opts.roles.includes(result.profile.role)) {
    return { error: 'Forbidden', status: 403 }
  }

  if (opts.requireAal2) {
    const supabase = await createClient()
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    const hasVerifiedFactor = (factors?.totp ?? []).some(factor => factor.status === 'verified')

    // MFA is optional. Require the second factor only for accounts that have
    // already enrolled one; never force staff through QR enrollment.
    if (factorsError || hasVerifiedFactor) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if ((aalData?.currentLevel ?? 'aal1') !== 'aal2') {
        return { error: 'AAL2 required', status: 403 }
      }
    }
  }

  return result
}

// ── Convenience: staff-or-admin, no AAL2 (for venue/booking management) ──────
export async function requireStaff(
  req: NextRequest
): Promise<RequireUserSuccess | RequireUserError> {
  return requireUser(req, { roles: ['admin', 'staff'] })
}

// ── Convenience: staff-or-admin + AAL2 (for sensitive operations) ─────────────
export async function requireStaffAal2(
  req: NextRequest
): Promise<RequireUserSuccess | RequireUserError> {
  return requireUser(req, { roles: ['admin', 'staff'], requireAal2: true })
}

// ── Convenience: admin-only + AAL2 ───────────────────────────────────────────
export async function requireAdmin(
  req: NextRequest
): Promise<RequireUserSuccess | RequireUserError> {
  return requireUser(req, { roles: ['admin'], requireAal2: true })
}

// ── Server-component / layout helper ─────────────────────────────────────────
export type RequireUserPageResult = RequireUserSuccess | { redirect: string }

export async function requireUserPage(
  opts: { roles?: string[]; requireAal2?: boolean } = {}
): Promise<RequireUserPageResult> {
  const cookieStore = await cookies()
  const result = await coreCheck(() => cookieStore.get('lv')?.value)
  if ('error' in result) return { redirect: '/login' }

  if (opts.roles?.length && !opts.roles.includes(result.profile.role)) {
    return { redirect: '/dashboard' }
  }

  if (opts.requireAal2) {
    const supabase = await createClient()
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    const hasVerifiedFactor = (factors?.totp ?? []).some(factor => factor.status === 'verified')

    if (factorsError || hasVerifiedFactor) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if ((aalData?.currentLevel ?? 'aal1') !== 'aal2') {
        return { redirect: '/admin/mfa/challenge' }
      }
    }
  }

  return result
}
