import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { getAllProviders } from "../../(db)/providers-repository"
import type { Provider } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  userId: string
}

export function createCustomApiTool(ctx: ToolContext) {
  return tool(
    async (input) => {
      const customTools = getAllProviders(ctx.userId).filter((p: Provider) => p.provider === "custom")
      const selectedTool = customTools.find((t: Provider) => t.name.toLowerCase() === input.toolName.toLowerCase())

      if (!selectedTool) {
        return {
          success: false,
          error: `Tool '${input.toolName}' not found. Available tools: ${customTools.map((t: Provider) => t.name).join(", ")}`,
        }
      }

      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: `custom_${selectedTool.name.toLowerCase().replace(/\s+/g, "_")}`,
        summary: `Calling ${selectedTool.name}: ${input.method} ${input.endpoint}`,
        timestamp: new Date().toISOString(),
      })

      try {
        const baseUrl = selectedTool.baseUrl || ""
        const url = baseUrl + input.endpoint

        const headers: Record<string, string> = {
          "Authorization": `Bearer ${selectedTool.apiKey}`,
          ...input.headers,
        }

        const response = await fetch(url, {
          method: input.method,
          headers,
          body: input.body,
          signal: AbortSignal.timeout(30000),
        })

        const responseText = await response.text()
        let responseData: unknown

        try {
          responseData = JSON.parse(responseText)
        } catch {
          responseData = responseText
        }

        return {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          toolDescription: selectedTool.defaultModel === "custom-tool" ? baseUrl : selectedTool.defaultModel,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Custom API request failed",
        }
      }
    },
    {
      name: "custom_api",
      description: "Make HTTP requests to custom API tools configured by the user. Use this when you need to call external APIs like VirusTotal, SecurityTrails, Censys, or any other configured tool. Check the tool descriptions to know which tool to use for specific tasks.",
      schema: z.object({
        toolName: z.string().describe("Name of the configured tool to use (e.g., 'VirusTotal', 'SecurityTrails')"),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
        endpoint: z.string().describe("API endpoint path (e.g., '/files/{hash}', '/urls')"),
        headers: z.record(z.string(), z.string()).optional().describe("Additional headers to send"),
        body: z.string().optional().describe("Request body for POST/PUT requests"),
      }),
    }
  )
}

export function getCustomToolsDescription(userId: string): string {
  const customTools = getAllProviders(userId).filter((p: Provider) => p.provider === "custom")

  if (customTools.length === 0) {
    return ""
  }

  const descriptions = customTools.map((tool: Provider) => {
    const description = tool.baseUrl || "No description provided"
    return `- **${tool.name}**: ${description}`
  })

  return `

## Custom API Tools Available

You have access to the following custom API tools configured by the user. Use the \`custom_api\` tool to call these APIs when needed:

${descriptions.join("\n")}

**Important**: Read each tool's description carefully to understand how to use it. The description explains the API's purpose, endpoints, and expected usage patterns.
`
}
