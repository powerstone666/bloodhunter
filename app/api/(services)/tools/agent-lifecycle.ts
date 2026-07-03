import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { createAgent, updateAgentStatus, getAgentsByScanId } from "../../(db)/agents-repository"
import { updateScanStatus } from "../../(db)/scans-repository"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  abortController?: AbortController
}

export function createAgentLifecycleTools(ctx: ToolContext) {
  const createAgentTool = tool(
    async (input) => {
      const childId = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

      createAgent({
        id: childId,
        scanId: ctx.scanId,
        parentId: ctx.agentId,
        name: input.name,
      })

      ctx.emitEvent({
        type: "agent.spawned",
        scanId: ctx.scanId,
        agentId: childId,
        parentId: ctx.agentId,
        name: input.name,
        timestamp: new Date().toISOString(),
      })

      return { success: true, agentId: childId, name: input.name, task: input.task, skills: input.skills || [] }
    },
    {
      name: "create_agent",
      description: "Create a specialized child agent to handle a specific task. Each child agent should have ONE focused job.",
      schema: z.object({
        name: z.string().describe("Descriptive name for the agent (e.g., 'SQLi Validation Agent')"),
        skills: z.array(z.string()).max(5).optional().describe("Skills to load for this agent"),
        task: z.string().describe("Specific task description for this agent"),
      }),
    }
  )

  const viewAgentGraph = tool(
    async () => {
      const agents = getAgentsByScanId(ctx.scanId)
      return { agents }
    },
    {
      name: "view_agent_graph",
      description: "View the current agent tree structure to understand the coordination state.",
      schema: z.object({}),
    }
  )

  const sendMessage = tool(
    async (input) => {
      ctx.emitEvent({
        type: "agent.log",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        level: "info",
        message: `Message to ${input.targetAgentId}: ${input.message}`,
        timestamp: new Date().toISOString(),
      })

      return { success: true, delivered: true }
    },
    {
      name: "send_message_to_agent",
      description: "Send a message to another agent for coordination.",
      schema: z.object({
        targetAgentId: z.string().describe("ID of the agent to message"),
        message: z.string().describe("Message content"),
        priority: z.enum(["low", "normal", "high", "critical"]).optional().describe("Message priority"),
      }),
    }
  )

  const waitForMessage = tool(
    async (input) => {
      const timeout = input.timeoutMs || 5000
      await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 5000)))
      return { success: true, messages: [] }
    },
    {
      name: "wait_for_message",
      description: "Wait for messages from other agents or user input. Use when you have nothing else to do.",
      schema: z.object({
        timeoutMs: z.number().optional().describe("Maximum wait time in milliseconds"),
      }),
    }
  )

  const agentFinish = tool(
    async (input) => {
      updateAgentStatus(ctx.agentId, input.success ? "completed" : "failed", new Date().toISOString())

      ctx.emitEvent({
        type: "agent.log",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        level: input.success ? "success" : "error",
        message: `Agent finished: ${input.summary}`,
        timestamp: new Date().toISOString(),
      })

      // Signal the agent loop to stop
      if (ctx.abortController) {
        ctx.abortController.abort()
      }

      return { success: true, finished: true }
    },
    {
      name: "agent_finish",
      description: "Signal that this agent has completed its task. This is the ONLY valid way to terminate an agent. Call this when you have finished all testing and reporting.",
      schema: z.object({
        summary: z.string().describe("Summary of what this agent accomplished"),
        success: z.boolean().describe("Whether the task was completed successfully"),
      }),
    }
  )

  const finishScan = tool(
    async (input) => {
      updateScanStatus(ctx.scanId, "completed", undefined, new Date().toISOString())

      ctx.emitEvent({
        type: "scan.completed",
        scanId: ctx.scanId,
        timestamp: new Date().toISOString(),
      })

      // Signal the agent loop to stop
      if (ctx.abortController) {
        ctx.abortController.abort()
      }

      return { success: true, finished: true, summary: input.summary, totalFindings: input.totalFindings }
    },
    {
      name: "finish_scan",
      description: "Signal that the entire scan is complete. Only the root agent should call this. Call this when ALL testing is done and ALL findings have been reported.",
      schema: z.object({
        summary: z.string().describe("Overall scan summary"),
        totalFindings: z.number().describe("Total number of vulnerabilities found"),
      }),
    }
  )

  return {
    create_agent: createAgentTool,
    view_agent_graph: viewAgentGraph,
    send_message_to_agent: sendMessage,
    wait_for_message: waitForMessage,
    agent_finish: agentFinish,
    finish_scan: finishScan,
  }
}
