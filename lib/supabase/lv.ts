/**
 * lv.ts — login-verified cookie helpers
 *
 * The "lv" cookie proves a user completed the full password+OTP login flow
 * (or signup email verification).  A Supabase session obtained by calling
 * verifyOtp directly — bypassing the password step — will not have this
 * cookie and is rejected by proxy.ts.
 *
 * Cookie value format  (base64url-encoded JSON):
 *   { uid: string, exp: number, sig: string }
 *   sig = HMAC-SHA256( uid + ":" + exp, LV_COOKIE_SECRET ) as hex
 *
 * Properties:
 *   • Uses LV_COOKIE_SECRET — a dedicated secret, NOT the Supabase JWT secret.
 *     Throws at startup if the env var is missing or shorter than 32 chars.
 *   • Bound to user.id — cannot be reused for a different account.
 *   • Carries an explicit exp (unix seconds) — rejected after COOKIE_TTL_SECONDS.
 *   • Verified with timingSafeEqual — no timing oracle on the HMAC.
 *   • HttpOnly, Secure (in production), SameSite=Lax, maxAge set.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

export const LV_COOKIE_NAME = 'lv'

// Cookie lifetime in seconds.  Must be ≤ Supabase Auth JWT expiry (default 3600 s).
export const COOKIE_TTL_SECONDS = 60 * 60 // 1 hour

// ── Secret bootstrap — fail fast ─────────────────────────────────────────────
// Evaluated once at module load.  If the secret is absent or too short the
// process will throw before the first request, surfacing the misconfiguration
// immediately rather than silently falling back to a weak value.
function loadSecret(): string {
  const s = process.env.LV_COOKIE_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'LV_COOKIE_SECRET env var is missing or shorter than 32 characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return s
}

// Module-level — throws at startup if misconfigured
const SECRET = loadSecret()

// ── HMAC ─────────────────────────────────────────────────────────────────────
function sign(uid: string, exp: number): string {
  return createHmac('sha256', SECRET)
    .update(`${uid}:${exp}`)
    .digest('hex')
}

// ── Create ────────────────────────────────────────────────────────────────────
export function createLvValue(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS
  const sig = sign(userId, exp)
  return Buffer.from(JSON.stringify({ uid: userId, exp, sig })).toString('base64url')
}

// ── Verify — returns userId if valid, null otherwise ─────────────────────────
export function verifyLvValue(value: string | undefined): string | null {
  if (!value) return null
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8')
    const { uid, exp, sig } = JSON.parse(decoded)
    if (typeof uid !== 'string' || typeof exp !== 'number') return null
    if (Math.floor(Date.now() / 1000) > exp) return null

    const expected = sign(uid, exp)
    // Lengths must match before timingSafeEqual (it throws on length mismatch)
    if (sig.length !== expected.length) return null
    const match = timingSafeEqual(
      Buffer.from(sig,      'hex'),
      Buffer.from(expected, 'hex')
    )
    return match ? uid : null
  } catch {
    return null
  }
}

// ── Seconds remaining on a valid cookie (0 if invalid) ───────────────────────
export function lvSecondsRemaining(value: string | undefined): number {
  if (!value) return 0
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8')
    const { exp } = JSON.parse(decoded)
    const remaining = (exp as number) - Math.floor(Date.now() / 1000)
    return remaining > 0 ? remaining : 0
  } catch {
    return 0
  }
}

// ── Cookie options ────────────────────────────────────────────────────────────
export function lvCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   COOKIE_TTL_SECONDS,
  }
}

// ── Clear options (for logout / password reset) ───────────────────────────────
export function lvClearOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  }
}
