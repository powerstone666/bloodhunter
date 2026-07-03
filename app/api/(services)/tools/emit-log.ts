import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
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

      return { success: true, logged: true, level: input.level }
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
