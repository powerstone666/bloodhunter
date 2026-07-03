import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  fetchFn?: typeof fetch
}

export function createTavilySearchTool(ctx: ToolContext) {
  const fetchFn = ctx.fetchFn || fetch
  const apiKey = process.env.TAVILY_API_KEY

  return tool(
    async (input) => {
      if (!apiKey) {
        return { success: false, error: "TAVILY_API_KEY not configured" }
      }

      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "tavily_search",
        summary: `Tavily search: ${input.query}`,
        timestamp: new Date().toISOString(),
      })

      try {
        const response = await fetchFn("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: input.query,
            max_results: input.maxResults || 5,
            search_depth: input.searchDepth || "basic",
            include_answer: true,
            include_raw_content: false,
          }),
          signal: AbortSignal.timeout(30000),
        })

        if (!response.ok) {
          const error = await response.text()
          return { success: false, error: `Tavily API error: ${response.status} - ${error}` }
        }

        const data = await response.json()
        
        return {
          success: true,
          query: input.query,
          answer: data.answer || null,
          results: data.results.map((r: { title: string; url: string; content: string; score: number }) => ({
            title: r.title,
            url: r.url,
            content: r.content,
            score: r.score,
          })),
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Tavily search failed" }
      }
    },
    {
      name: "tavily_search",
      description: "Search the web using Tavily AI search API. Returns high-quality, relevant results optimized for AI agents. Use for researching vulnerabilities, exploits, CVEs, and security techniques.",
      schema: z.object({
        query: z.string().describe("Search query"),
        maxResults: z.number().optional().describe("Maximum number of results (default: 5, max: 10)"),
        searchDepth: z.enum(["basic", "advanced"]).optional().describe("Search depth (default: basic)"),
      }),
    }
  )
}
