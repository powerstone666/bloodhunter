import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  fetchFn?: typeof fetch
}

export function createWebSearchTool(ctx: ToolContext) {
  const fetchFn = ctx.fetchFn || fetch

  return tool(
    async (input) => {
      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "web_search",
        summary: `Searching: ${input.query}`,
        timestamp: new Date().toISOString(),
      })

      try {
        const response = await fetchFn(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
        })

        const html = await response.text()
        const results: Array<{ title: string; snippet: string; url: string }> = []

        const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
        let match
        const snippets: string[] = []
        let snippetMatch
        while ((snippetMatch = snippetRegex.exec(html)) !== null) {
          snippets.push(snippetMatch[1].replace(/<[^>]+>/g, ""))
        }
        let i = 0
        while ((match = resultRegex.exec(html)) !== null && results.length < 10) {
          results.push({
            url: decodeURIComponent(match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]),
            title: match[2].replace(/<[^>]+>/g, ""),
            snippet: snippets[i] || "",
          })
          i++
        }

        return { success: true, query: input.query, results }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Search failed" }
      }
    },
    {
      name: "web_search",
      description: "Search the web for information. Use this to research payloads, bypass techniques, CVE details, tool documentation, or any security-related information.",
      schema: z.object({
        query: z.string().describe("Search query"),
      }),
    }
  )
}
