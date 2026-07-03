import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { loadSkill } from "../skill-loader"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
}

export function createLoadSkillTool(ctx: ToolContext) {
  return tool(
    async (input) => {
      const loaded: Array<{ id: string; name: string; description: string; content: string }> = []
      const notFound: string[] = []

      for (const skillId of input.skills) {
        const skill = loadSkill(skillId)
        if (skill) {
          loaded.push({ id: skill.id, name: skill.name, description: skill.description, content: skill.content })
        } else {
          notFound.push(skillId)
        }
      }

      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "load_skill",
        summary: `Loaded ${loaded.length} skills: ${loaded.map(s => s.name).join(", ")}`,
        timestamp: new Date().toISOString(),
      })

      return { loaded, notFound }
    },
    {
      name: "load_skill",
      description: "Load a specialized skill on-demand to get detailed guidance for a specific vulnerability type, tool, framework, or protocol. Use this before starting specialized testing.",
      schema: z.object({
        skills: z.array(z.string()).max(5).describe("List of skill IDs to load (e.g., 'sql_injection', 'xss', 'tooling/nmap')"),
      }),
    }
  )
}
