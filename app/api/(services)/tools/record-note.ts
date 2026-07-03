import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
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

      return {
        success: true,
        noteId: `note-${Date.now()}`,
        title: input.title,
        content: input.content,
        category: input.category,
      }
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
