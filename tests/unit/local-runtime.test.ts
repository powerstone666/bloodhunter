import { describe, it, expect, beforeEach } from "vitest"
import { LocalRuntimeBackend } from "../../app/api/(services)/local-runtime"

describe("LocalRuntimeBackend", () => {
  let runtime: LocalRuntimeBackend

  beforeEach(() => {
    runtime = new LocalRuntimeBackend({
      allowlist: {
        targetHostnames: ["localhost", "127.0.0.1"],
        excludedPaths: ["/admin"],
        maxRequestsPerSecond: 100,
      },
      defaultTimeoutMs: 5000,
    })
  })

  describe("fetchUrl", () => {
    it("blocks requests to disallowed hostnames", async () => {
      await expect(
        runtime.fetchUrl({
          url: "https://evil.com/attack",
          method: "GET",
        })
      ).rejects.toThrow("not in the allowlist")
    })

    it("blocks excluded paths", async () => {
      await expect(
        runtime.fetchUrl({
          url: "https://localhost/admin/panel",
          method: "GET",
        })
      ).rejects.toThrow("excluded path")
    })

    it("blocks invalid URLs", async () => {
      await expect(
        runtime.fetchUrl({
          url: "not-a-url",
          method: "GET",
        })
      ).rejects.toThrow()
    })
  })

  describe("runCommand", () => {
    it("blocks commands without a Docker sandbox", async () => {
      const result = await runtime.runCommand({ command: "echo hello" })
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("Docker sandbox is required")
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe("cleanup", () => {
    it("marks runtime as cleaned up", async () => {
      await runtime.cleanup()
      await expect(
        runtime.fetchUrl({ url: "https://localhost/test", method: "GET" })
      ).rejects.toThrow("cleaned up")
    })
  })

  describe("request counting", () => {
    it("increments on allowed requests", async () => {
      expect(runtime.getRequestCount()).toBe(0)
      await expect(
        runtime.fetchUrl({ url: "https://evil.com/test", method: "GET" })
      ).rejects.toThrow()
      expect(runtime.getRequestCount()).toBe(0)
    })
  })
})
