interface RateLimitEntry {
  count: number
  resetAt: number
}

interface ScanLimitEntry {
  count: number
  resetAt: number
}

const rateLimits = new Map<string, RateLimitEntry>()
const scanLimits = new Map<string, ScanLimitEntry>()

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30
const SCAN_LIMIT_WINDOW_MS = 3_600_000
const SCAN_LIMIT_MAX_SCANS = 10

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimits.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt: now + RATE_LIMIT_WINDOW_MS }
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetAt: entry.resetAt }
}

export function checkScanLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = scanLimits.get(userId)

  if (!entry || now > entry.resetAt) {
    scanLimits.set(userId, { count: 1, resetAt: now + SCAN_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: SCAN_LIMIT_MAX_SCANS - 1, resetAt: now + SCAN_LIMIT_WINDOW_MS }
  }

  if (entry.count >= SCAN_LIMIT_MAX_SCANS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: SCAN_LIMIT_MAX_SCANS - entry.count, resetAt: entry.resetAt }
}

export function getRateLimitHeaders(userId: string): Record<string, string> {
  const { remaining, resetAt } = checkRateLimit(userId)
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  }
}
