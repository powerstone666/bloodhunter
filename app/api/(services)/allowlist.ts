import { URL } from "url"

export interface AllowlistConfig {
  targetHostnames: string[]
  excludedPaths: string[]
  maxRequestsPerSecond: number
}

export interface AllowlistValidation {
  allowed: boolean
  reason?: string
}

export function createAllowlist(config: AllowlistConfig): AllowlistConfig {
  return {
    targetHostnames: config.targetHostnames.map(h => h.toLowerCase()),
    excludedPaths: config.excludedPaths.map(p => p.toLowerCase()),
    maxRequestsPerSecond: config.maxRequestsPerSecond || 10,
  }
}

export function isUrlAllowed(url: string, allowlist: AllowlistConfig): AllowlistValidation {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    const hostnameAllowed = allowlist.targetHostnames.some(h => {
      if (h.startsWith("*.")) {
        const suffix = h.slice(1)
        return hostname === suffix.slice(1) || hostname.endsWith(suffix)
      }
      return hostname === h
    })

    if (!hostnameAllowed) {
      return {
        allowed: false,
        reason: `Hostname "${hostname}" is not in the allowlist: ${allowlist.targetHostnames.join(", ")}`,
      }
    }

    const pathLower = parsed.pathname.toLowerCase()
    const pathExcluded = allowlist.excludedPaths.some(p => pathLower.startsWith(p))
    if (pathExcluded) {
      return {
        allowed: false,
        reason: `Path "${parsed.pathname}" matches excluded path`,
      }
    }

    return { allowed: true }
  } catch {
    return {
      allowed: false,
      reason: `Invalid URL: ${url}`,
    }
  }
}

export function extractTargetHostnames(targetUrl: string, scopeMode: string): string[] {
  try {
    const parsed = new URL(targetUrl)
    const hostname = parsed.hostname.toLowerCase()

    switch (scopeMode) {
      case "same-host":
        return [hostname]
      case "subdomains":
        return [`*.${hostname}`, hostname]
      case "custom":
        return [hostname]
      default:
        return [hostname]
    }
  } catch {
    return []
  }
}

export class RateLimiter {
  private timestamps: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequestsPerSecond: number) {
    this.maxRequests = maxRequestsPerSecond
    this.windowMs = 1000
  }

  canProceed(): boolean {
    const now = Date.now()
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs)
    return this.timestamps.length < this.maxRequests
  }

  record(): void {
    this.timestamps.push(Date.now())
  }

  waitMs(): number {
    if (this.timestamps.length === 0) return 0
    const oldest = this.timestamps[0]
    return Math.max(0, this.windowMs - (Date.now() - oldest))
  }
}
