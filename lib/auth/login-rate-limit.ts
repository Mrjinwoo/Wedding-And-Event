import 'server-only'
import { createHash } from 'node:crypto'

type Bucket = { hits: number[] }

const WINDOW_MS = 5 * 60 * 1000
const EMAIL_LIMIT = 5
const IP_LIMIT = 5
const BUCKETS_KEY = '__weddingLoginRateLimitBuckets'

type RateLimitGlobal = typeof globalThis & {
  [BUCKETS_KEY]?: Map<string, Bucket>
}

const globalForRateLimit = globalThis as RateLimitGlobal
const buckets = globalForRateLimit[BUCKETS_KEY] ?? new Map<string, Bucket>()
globalForRateLimit[BUCKETS_KEY] = buckets

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function consume(key: string, limit: number, now: number) {
  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter(timestamp => timestamp > now - WINDOW_MS)
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    return Math.max(1, Math.ceil((bucket.hits[0] + WINDOW_MS - now) / 1000))
  }
  bucket.hits.push(now)
  buckets.set(key, bucket)
  return 0
}

export function getLoginClientIp(headers: Headers) {
  // Prefer the proxy-provided address, then use the first forwarded address.
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const forwardedIp = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedIp || 'unknown'
}

export function consumeLoginAttempt(ip: string, email: string) {
  const now = Date.now()

  // Bound memory growth while cleaning up expired entries.
  if (buckets.size > 10_000) {
    for (const [key, bucket] of buckets) {
      if (bucket.hits.every(timestamp => timestamp <= now - WINDOW_MS)) buckets.delete(key)
    }
  }

  const keys = [
    { key: `ip:${fingerprint(ip)}`, limit: IP_LIMIT },
    { key: `email:${fingerprint(email.trim().toLowerCase())}`, limit: EMAIL_LIMIT },
  ]

  // Check both dimensions before recording, so a blocked request does not
  // consume quota in the other bucket.
  const blockedFor = keys.reduce((longest, item) => {
    const bucket = buckets.get(item.key)
    if (!bucket) return longest
    const liveHits = bucket.hits.filter(timestamp => timestamp > now - WINDOW_MS)
    if (liveHits.length < item.limit) return longest
    return Math.max(longest, Math.ceil((liveHits[0] + WINDOW_MS - now) / 1000))
  }, 0)

  if (blockedFor > 0) return { allowed: false, retryAfter: blockedFor }

  for (const item of keys) consume(item.key, item.limit, now)
  return { allowed: true, retryAfter: 0 }
}
