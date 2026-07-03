import { tool } from "@langchain/core/tools"
import { z } from "zod"

export interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: { type: string; [key: string]: unknown }) => void
}

export function createRecordNoteTool(ctx: ToolContext) {
  return tool(
    async (input) => {
      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "record_note",
        summary: `Note recorded: ${input.title}`,
        timestamp: new Date().toISOString(),
      })

      return JSON.stringify({
        success: true,
        noteId: `note-${Date.now()}`,
        title: input.title,
        content: input.content,
        category: input.category,
      })
    },
    {
      name: "record_note",
      description: "Record a structured note about a finding, observation, or piece of information discovered during the scan.",
      schema: z.object({
        title: z.string().describe("Short title for the note"),
        content: z.string().describe("Detailed content of the note"),
        category: z.enum(["finding", "observation", "endpoint", "technology", "credential"]).describe("Category of the note"),
      }),
    }
  )
}

export function createEmitLogTool(ctx: ToolContext) {
  return tool(
    async (input) => {
      ctx.emitEvent({
        type: "agent.log",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        level: input.level,
        message: input.message,
        timestamp: new Date().toISOString(),
      })

      return JSON.stringify({
        success: true,
        logged: true,
        level: input.level,
      })
    },
    {
      name: "emit_log",
      description: "Emit a structured log message to the scan event stream for visibility into agent actions.",
      schema: z.object({
        level: z.enum(["info", "warn", "error", "success"]).describe("Log level"),
        message: z.string().describe("Log message content"),
      }),
    }
  )
}

export function createHttpRequestTool(ctx: ToolContext, fetchFn: typeof fetch) {
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
            const [key, value] = pair.split(":").map(s => s.trim())
            if (key && value) headers[key] = value
          }
        }

        const start = Date.now()
        const response = await fetchFn(input.url, {
          method: input.method,
          headers,
          body: input.body,
          signal: AbortSignal.timeout(input.timeoutMs || 15000),
          redirect: "follow",
        })

        const body = await response.text()
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value
        })

        return JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: body.substring(0, 10000),
          elapsedMs: Date.now() - start,
        })
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : "Request failed",
        })
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
