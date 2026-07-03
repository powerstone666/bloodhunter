import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
}

export function createThinkTool(ctx: ToolContext) {
  return tool(
    async (input) => {
      ctx.emitEvent({
        type: "agent.log",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        level: "info",
        message: `Thinking: ${input.thought.substring(0, 200)}...`,
        timestamp: new Date().toISOString(),
      })

      return { success: true, thought: input.thought }
    },
    {
      name: "think",
      description: "Use this tool to think through complex problems, plan multi-step approaches, analyze situations, or make decisions. This is your internal reasoning space.",
      schema: z.object({
        thought: z.string().describe("Your detailed reasoning, analysis, or plan"),
      }),
    }
  )
}
