import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { createEndpoint } from "../../(db)/endpoints-repository"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
}

export function createReportEndpointTool(ctx: ToolContext) {
  return tool(
    async (input) => {
      const endpoint = createEndpoint({
        scanId: ctx.scanId,
        url: input.url,
        method: input.method || "GET",
        statusCode: input.statusCode ?? null,
        contentType: input.contentType ?? null,
        title: input.title ?? null,
        technologies: input.technologies ?? null,
      })

      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "report_endpoint",
        summary: `Endpoint: ${input.method || "GET"} ${input.url} (${input.statusCode || "?"})`,
        timestamp: new Date().toISOString(),
      })

      return { success: true, endpointId: endpoint.id, url: input.url }
    },
    {
      name: "report_endpoint",
      description: "Report a discovered endpoint (URL) to the scan results. Use this when you find a valid URL, page, API endpoint, or resource.",
      schema: z.object({
        url: z.string().describe("The discovered URL"),
        method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]).optional().describe("HTTP method used"),
        statusCode: z.number().optional().describe("HTTP status code received"),
        contentType: z.string().optional().describe("Content-Type header value"),
        title: z.string().optional().describe("Page title if HTML"),
        technologies: z.string().optional().describe("Detected technologies, comma-separated"),
      }),
    }
  )
}
