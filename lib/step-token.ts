import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL = 10 * 60 * 1000 // 10 minutes
const CONSUMED_KEY = '__weddingConsumedLoginStepTokens'
const consumedGlobal = globalThis as typeof globalThis & {
  [CONSUMED_KEY]?: Map<string, number>
}
const consumedTokens = consumedGlobal[CONSUMED_KEY] ?? new Map<string, number>()
consumedGlobal[CONSUMED_KEY] = consumedTokens

function signPayload(email: string, exp: number, id: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.')
  }
  return createHmac('sha256', secret).update(`${email}:${exp}:${id}`).digest('hex')
}

export function createStepToken(email: string): string {
  const exp = Date.now() + TOKEN_TTL
  const id = randomUUID()
  const sig = signPayload(email, exp, id)
  return Buffer.from(JSON.stringify({ e: email, exp, id, sig })).toString('base64url')
}

function readStepToken(token: string, email: string) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const value: unknown = JSON.parse(decoded)
    if (!value || typeof value !== 'object') return null
    const { e, exp, id, sig } = value as Record<string, unknown>
    if (e !== email || typeof exp !== 'number' || typeof id !== 'string' || typeof sig !== 'string') return null
    if (!Number.isFinite(exp) || Date.now() > exp || !id || !/^[a-f0-9]{64}$/i.test(sig)) return null
    const expected = signPayload(e, exp, id)
    const actualBuffer = Buffer.from(sig, 'hex')
    const expectedBuffer = Buffer.from(expected, 'hex')
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
    return { id, exp }
  } catch {
    return null
  }
}

export function verifyStepToken(token: string, email: string): boolean {
  const payload = readStepToken(token, email)
  if (!payload) return false
  return !consumedTokens.has(payload.id)
}

// Consume only after Supabase accepts the OTP, so an incorrect code does not
// force the user to repeat the password step.
export function consumeStepToken(token: string, email: string): boolean {
  const payload = readStepToken(token, email)
  if (!payload || consumedTokens.has(payload.id)) return false

  if (consumedTokens.size > 1000) {
    for (const [id, exp] of consumedTokens) {
      if (exp < Date.now()) consumedTokens.delete(id)
    }
  }
  consumedTokens.set(payload.id, payload.exp)
  return true
}
