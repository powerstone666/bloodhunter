import { describe, it, expect } from "vitest"
import { isUrlAllowed, createAllowlist, extractTargetHostnames, RateLimiter } from "../../app/api/(services)/allowlist"

describe("createAllowlist", () => {
  it("normalizes hostnames to lowercase", () => {
    const allowlist = createAllowlist({
      targetHostnames: ["EXAMPLE.COM", "Test.Com"],
      excludedPaths: [],
      maxRequestsPerSecond: 10,
    })
    expect(allowlist.targetHostnames).toEqual(["example.com", "test.com"])
  })
})

describe("isUrlAllowed", () => {
  const allowlist = createAllowlist({
    targetHostnames: ["example.com", "*.sub.example.com"],
    excludedPaths: ["/admin", "/internal"],
    maxRequestsPerSecond: 10,
  })

  it("allows exact hostname match", () => {
    expect(isUrlAllowed("https://example.com/page", allowlist)).toEqual({ allowed: true })
  })

  it("allows wildcard subdomain match", () => {
    expect(isUrlAllowed("https://api.sub.example.com/test", allowlist)).toEqual({ allowed: true })
  })

  it("blocks unknown hostname", () => {
    const result = isUrlAllowed("https://evil.com/attack", allowlist)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("not in the allowlist")
  })

  it("blocks excluded path", () => {
    const result = isUrlAllowed("https://example.com/admin/panel", allowlist)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("excluded path")
  })

  it("blocks invalid URL", () => {
    const result = isUrlAllowed("not-a-url", allowlist)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("Invalid URL")
  })
})

describe("extractTargetHostnames", () => {
  it("extracts single host for same-host scope", () => {
    expect(extractTargetHostnames("https://example.com/path", "same-host")).toEqual(["example.com"])
  })

  it("extracts wildcard for subdomains scope", () => {
    expect(extractTargetHostnames("https://app.example.com/path", "subdomains")).toEqual(["*.app.example.com", "app.example.com"])
  })

  it("returns empty array for invalid URL", () => {
    expect(extractTargetHostnames("not-a-url", "same-host")).toEqual([])
  })
})

describe("RateLimiter", () => {
  it("allows requests within limit", () => {
    const limiter = new RateLimiter(5)
    expect(limiter.canProceed()).toBe(true)
    limiter.record()
    expect(limiter.canProceed()).toBe(true)
  })

  it("blocks requests over limit", () => {
    const limiter = new RateLimiter(2)
    limiter.record()
    limiter.record()
    expect(limiter.canProceed()).toBe(false)
  })
})
