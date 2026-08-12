// ============================================================
// LoginRateLimiter — Rate limiting por IP + usuario + dispositivo
// ------------------------------------------------------------
// FASE 12 (issue #47)
// ============================================================

interface RateBucket {
  count: number
  firstAttemptAt: number
  lockedUntil?: number
}

const WINDOW_MS = 15 * 60 * 1000
const IP_MAX = 20
const DEVICE_MAX = 10

const ipBuckets = new Map<string, RateBucket>()
const deviceBuckets = new Map<string, RateBucket>()

function cleanupBuckets(buckets: Map<string, RateBucket>) {
  const now = Date.now()
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.firstAttemptAt > WINDOW_MS && (!bucket.lockedUntil || now > bucket.lockedUntil)) {
      buckets.delete(key)
    }
  }
}

function getBucket(buckets: Map<string, RateBucket>, key: string): RateBucket {
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { count: 0, firstAttemptAt: Date.now() }
    buckets.set(key, bucket)
  }
  return bucket
}

export interface RateCheckResult {
  ok: boolean
  retryAfterMs?: number
  reason?: 'IP_BLOCKED' | 'DEVICE_BLOCKED'
  remaining?: number
}

export function checkRateLimit(ip: string, deviceId?: string): RateCheckResult {
  cleanupBuckets(ipBuckets)
  cleanupBuckets(deviceBuckets)

  const now = Date.now()

  const ipBucket = getBucket(ipBuckets, ip)
  if (ipBucket.lockedUntil && now < ipBucket.lockedUntil) {
    return {
      ok: false,
      retryAfterMs: ipBucket.lockedUntil - now,
      reason: 'IP_BLOCKED',
      remaining: 0,
    }
  }

  if (deviceId) {
    const devBucket = getBucket(deviceBuckets, deviceId)
    if (devBucket.lockedUntil && now < devBucket.lockedUntil) {
      return {
        ok: false,
        retryAfterMs: devBucket.lockedUntil - now,
        reason: 'DEVICE_BLOCKED',
        remaining: 0,
      }
    }
  }

  return { ok: true }
}

export function recordFailedAttempt(ip: string, deviceId?: string): RateCheckResult {
  const now = Date.now()

  const ipBucket = getBucket(ipBuckets, ip)
  if (now - ipBucket.firstAttemptAt > WINDOW_MS) {
    ipBucket.count = 0
    ipBucket.firstAttemptAt = now
    ipBucket.lockedUntil = undefined
  }
  ipBucket.count++
  if (ipBucket.count >= IP_MAX) {
    ipBucket.lockedUntil = now + WINDOW_MS
    return {
      ok: false,
      retryAfterMs: WINDOW_MS,
      reason: 'IP_BLOCKED',
      remaining: 0,
    }
  }

  if (deviceId) {
    const devBucket = getBucket(deviceBuckets, deviceId)
    if (now - devBucket.firstAttemptAt > WINDOW_MS) {
      devBucket.count = 0
      devBucket.firstAttemptAt = now
      devBucket.lockedUntil = undefined
    }
    devBucket.count++
    if (devBucket.count >= DEVICE_MAX) {
      devBucket.lockedUntil = now + WINDOW_MS
      return {
        ok: false,
        retryAfterMs: WINDOW_MS,
        reason: 'DEVICE_BLOCKED',
        remaining: 0,
      }
    }
  }

  return {
    ok: true,
    remaining: Math.max(IP_MAX - ipBucket.count, deviceId ? DEVICE_MAX - (deviceBuckets.get(deviceId)?.count || 0) : IP_MAX),
  }
}

export function recordSuccessfulAttempt(ip: string, deviceId?: string) {
  ipBuckets.delete(ip)
  if (deviceId) deviceBuckets.delete(deviceId)
}

export function getRateLimitStats() {
  return {
    ipBucketsTracked: ipBuckets.size,
    deviceBucketsTracked: deviceBuckets.size,
    blockedIps: Array.from(ipBuckets.entries()).filter(([_, b]) => b.lockedUntil && Date.now() < b.lockedUntil!).length,
  }
}
