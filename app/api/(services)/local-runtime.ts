import type {
  RuntimeBackend,
  HttpRequestOptions,
  HttpRequestResult,
  CommandOptions,
  CommandResult,
} from "./runtime-backend"
import { isUrlAllowed, createAllowlist, type AllowlistConfig } from "./allowlist"

export interface LocalRuntimeConfig {
  allowlist: AllowlistConfig
  defaultTimeoutMs?: number
  maxOutputBytes?: number
}

export class LocalRuntimeBackend implements RuntimeBackend {
  readonly name = "local"
  readonly type = "local"

  private allowlist: AllowlistConfig
  private defaultTimeoutMs: number
  private maxOutputBytes: number
  private requestCount = 0
  private cleanedUp = false

  constructor(config: LocalRuntimeConfig) {
    this.allowlist = createAllowlist(config.allowlist)
    this.defaultTimeoutMs = config.defaultTimeoutMs || 30000
    this.maxOutputBytes = config.maxOutputBytes || 1024 * 1024
  }

  async fetchUrl(options: HttpRequestOptions): Promise<HttpRequestResult> {
    if (this.cleanedUp) {
      throw new Error("Runtime has been cleaned up")
    }

    const validation = isUrlAllowed(options.url, this.allowlist)
    if (!validation.allowed) {
      throw new Error(`Request blocked: ${validation.reason}`)
    }

    this.requestCount++
    const start = Date.now()

    const controller = new AbortController()
    const timeoutMs = options.timeout || this.defaultTimeoutMs
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const headers: Record<string, string> = {
        "User-Agent": "Bloodhunter/1.0",
        ...options.headers,
      }

      const response = await fetch(options.url, {
        method: options.method,
        headers,
        body: options.method !== "GET" && options.method !== "HEAD" ? options.body : undefined,
        signal: controller.signal,
        redirect: "follow",
      })

      const body = await response.text()
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body,
        elapsedMs: Date.now() - start,
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async runCommand(options: CommandOptions): Promise<CommandResult> {
    if (this.cleanedUp) {
      throw new Error("Runtime has been cleaned up")
    }

    const error = "Command blocked: Docker sandbox is required."
    return {
      exitCode: 1,
      stdout: "",
      stderr: error,
      elapsedMs: 0,
    }
  }

  async cleanup(): Promise<void> {
    this.cleanedUp = true
  }

  getRequestCount(): number {
    return this.requestCount
  }
}
