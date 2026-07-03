import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  fetchFn?: typeof fetch
}

export function createHttpRequestTool(ctx: ToolContext) {
  const fetchFn = ctx.fetchFn || fetch

  return tool(
    async (input) => {
      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "http_request",
        summary: `${input.method} ${input.url}`,
        timestamp: new Date().toISOString(),
      })

      try {
        const headers: Record<string, string> = {}
        if (input.headers) {
          for (const pair of input.headers.split(",")) {
            const parts = pair.split(":")
            const key = parts[0]?.trim()
            const value = parts.slice(1).join(":").trim()
            if (key && value) headers[key] = value
          }
        }

        const start = Date.now()
        const response = await fetchFn(input.url, {
          method: input.method,
          headers,
          body: input.method !== "GET" && input.method !== "HEAD" ? input.body : undefined,
          signal: AbortSignal.timeout(input.timeoutMs || 15000),
          redirect: "follow",
        })

        const body = await response.text()
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value: string, key: string) => {
          responseHeaders[key] = value
        })

        return {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: body.substring(0, 10000),
          elapsedMs: Date.now() - start,
        }
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Request failed" }
      }
    },
    {
      name: "http_request",
      description: "Make an HTTP request to a URL and return the response. Use for fetching web pages, APIs, or testing endpoints.",
      schema: z.object({
        url: z.string().describe("Target URL"),
        method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]).describe("HTTP method"),
        headers: z.string().optional().describe("Headers as comma-separated key:value pairs"),
        body: z.string().optional().describe("Request body for POST/PUT"),
        timeoutMs: z.number().optional().describe("Timeout in milliseconds"),
      }),
    }
  )
}
