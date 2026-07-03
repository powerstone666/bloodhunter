import { createDeepAgent } from "deepagents"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { ScanConfig, ScanEvent } from "@/app/(common-lib)/schemas"
import { renderReconPrompt } from "./prompt-renderer"
import { DockerSandbox } from "./docker-sandbox"
import { log } from "./logger"
import {
  createRecordNoteTool,
  createEmitLogTool,
  createHttpRequestTool,
  createReportEndpointTool,
  createReportFindingTool,
  createThinkTool,
  createLoadSkillTool,
  createTodoTools,
  createNoteTools,
  createWebSearchTool,
  createTavilySearchTool,
  createShodanTool,
  createAgentLifecycleTools,
  createShellTools,
  createCustomApiTool,
  getCustomToolsDescription,
} from "./tools"
import type { StructuredTool } from "@langchain/core/tools"

export interface AgentConfig {
  scanId: string
  agentId: string
  userId: string
  model: BaseChatModel
  systemPrompt: string
  initialTask: string
  onEvent: (event: ScanEvent) => void
  abortSignal?: AbortSignal
  fetchFn?: typeof fetch
  sandbox?: DockerSandbox
}

export interface AgentRunResult {
  success: boolean
  output: string
  events: ScanEvent[]
}

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  fetchFn?: typeof fetch
  userId: string
  abortController?: AbortController
  sandbox?: DockerSandbox
}

export class AgentHarness {
  private events: ScanEvent[] = []
  private readonly ctx: ToolContext

  constructor(
    private readonly scanId: string,
    private readonly agentId: string,
    private readonly userId: string,
    private readonly onEvent: (event: ScanEvent) => void,
    fetchFn: typeof fetch = fetch,
    sandbox?: DockerSandbox
  ) {
    log.info("AGENT", "AgentHarness constructed", { scanId, agentId, userId, sandbox: sandbox ? "docker" : "none" })
    this.ctx = {
      scanId,
      agentId,
      emitEvent: (event) => this.emitEvent(event),
      fetchFn,
      userId,
      sandbox,
    }
  }

  private emitEvent(event: ScanEvent): void {
    this.events.push(event)
    this.onEvent(event)
  }

  createTools(): StructuredTool[] {
    log.debug("AGENT", "Creating tools...")

    const todoTools = createTodoTools(this.ctx)
    const noteTools = createNoteTools(this.ctx)
    const agentTools = createAgentLifecycleTools(this.ctx)
    const shellTools = createShellTools(this.ctx)

    const allTools = {
      record_note: createRecordNoteTool(this.ctx),
      emit_log: createEmitLogTool(this.ctx),
      http_request: createHttpRequestTool(this.ctx),
      report_endpoint: createReportEndpointTool(this.ctx),
      report_finding: createReportFindingTool(this.ctx),
      think: createThinkTool(this.ctx),
      load_skill: createLoadSkillTool(this.ctx),
      web_search: createWebSearchTool(this.ctx),
      tavily_search: createTavilySearchTool(this.ctx),
      shodan: createShodanTool(this.ctx),
      custom_api: createCustomApiTool(this.ctx),
      ...todoTools,
      ...noteTools,
      ...agentTools,
      ...shellTools,
    }

    const toolNames = Object.keys(allTools)
    log.success("AGENT", `Tools created`, { count: toolNames.length, tools: toolNames.join(", ") })

    return Object.values(allTools) as StructuredTool[]
  }

  async run(config: Omit<AgentConfig, "scanId" | "agentId" | "onEvent">): Promise<AgentRunResult> {
    log.info("AGENT", "Agent run starting", { scanId: this.scanId, agentId: this.agentId })

    this.emitEvent({
      type: "agent.spawned",
      scanId: this.scanId,
      agentId: this.agentId,
      name: "Security Agent",
      timestamp: new Date().toISOString(),
    })

    this.emitEvent({
      type: "agent.log",
      scanId: this.scanId,
      agentId: this.agentId,
      level: "info",
      message: "Agent started",
      timestamp: new Date().toISOString(),
    })

    // Create internal abort controller that tools can trigger
    const internalAbort = new AbortController()
    log.debug("AGENT", "Internal abort controller created")

    // Link external abort signal to internal controller
    if (config.abortSignal) {
      if (config.abortSignal.aborted) {
        log.warn("AGENT", "External abort signal already aborted")
        internalAbort.abort()
      } else {
        config.abortSignal.addEventListener("abort", () => {
          log.warn("AGENT", "External abort signal received — propagating to internal controller")
          internalAbort.abort()
        }, { once: true })
        log.debug("AGENT", "External abort signal linked to internal controller")
      }
    }

    // Pass abort controller to tool context so finish_scan/agent_finish can stop the loop
    this.ctx.abortController = internalAbort
    log.debug("AGENT", "Abort controller passed to tool context")

    try {
      log.startTimer("tool-creation")
      const tools = this.createTools()
      log.stopTimer("tool-creation", "AGENT")

      const customToolsDesc = getCustomToolsDescription(this.userId)
      const systemPrompt = config.systemPrompt + customToolsDesc
      log.debug("AGENT", "System prompt assembled", {
        baseLength: config.systemPrompt.length,
        customToolsLength: customToolsDesc.length,
        totalLength: systemPrompt.length,
      })

      // Create DeepAgent with LangChain model and tools
      log.info("AGENT", "Creating DeepAgent instance...")
      log.startTimer("deepagent-init")
      const agent = createDeepAgent({
        model: config.model,
        tools,
        systemPrompt,
      })
      log.stopTimer("deepagent-init", "AGENT")
      log.success("AGENT", "DeepAgent created", { toolCount: tools.length, promptLength: systemPrompt.length })

      // Run the agent with the initial task
      log.divider("DEEPAGENT INVOCATION")
      log.info("AGENT", "Invoking DeepAgent with initial task...")
      log.startTimer("deepagent-run")

      const result = await agent.invoke({
        messages: [
          {
            role: "user",
            content: config.initialTask,
          },
        ],
      })

      log.stopTimer("deepagent-run", "AGENT")

      // Extract the final output from the agent's response
      const output = result.messages?.[result.messages.length - 1]?.content || ""
      const messageCount = result.messages?.length || 0

      log.success("AGENT", "DeepAgent invocation completed", {
        messageCount,
        outputLength: typeof output === "string" ? output.length : 0,
        totalEvents: this.events.length,
      })

      this.emitEvent({
        type: "agent.log",
        scanId: this.scanId,
        agentId: this.agentId,
        level: "success",
        message: `Agent completed successfully — ${messageCount} messages, ${this.events.length} events`,
        timestamp: new Date().toISOString(),
      })

      return { success: true, output: typeof output === "string" ? output : JSON.stringify(output), events: this.events }
    } catch (error) {
      log.stopTimer("deepagent-run", "AGENT")

      // If aborted by finish_scan/agent_finish, treat as success
      if (internalAbort.signal.aborted) {
        log.success("AGENT", "Agent self-terminated via finish_scan/agent_finish", { totalEvents: this.events.length })

        this.emitEvent({
          type: "agent.log",
          scanId: this.scanId,
          agentId: this.agentId,
          level: "success",
          message: "Agent finished via self-termination",
          timestamp: new Date().toISOString(),
        })

        return { success: true, output: "Agent finished via finish_scan or agent_finish", events: this.events }
      }

      const errorMessage = error instanceof Error ? error.message : "Agent failed"
      const errorStack = error instanceof Error ? error.stack?.substring(0, 500) : undefined

      log.error("AGENT", "DeepAgent invocation failed", undefined, {
        error: errorMessage,
        stack: errorStack,
        totalEvents: this.events.length,
      })

      this.emitEvent({
        type: "agent.log",
        scanId: this.scanId,
        agentId: this.agentId,
        level: "error",
        message: `Agent failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      })

      return { success: false, output: errorMessage, events: this.events }
    }
  }
}

export async function runAgent(config: AgentConfig): Promise<AgentRunResult> {
  log.info("AGENT", "runAgent() called", { scanId: config.scanId, agentId: config.agentId })
  const harness = new AgentHarness(
    config.scanId,
    config.agentId,
    config.userId,
    config.onEvent,
    config.fetchFn,
    config.sandbox
  )

  return harness.run({
    userId: config.userId,
    model: config.model,
    systemPrompt: config.systemPrompt,
    initialTask: config.initialTask,
    abortSignal: config.abortSignal,
    sandbox: config.sandbox,
  })
}

export function buildRootScanTask(config: ScanConfig): string {
  const sections: string[] = [
    "Scan the following web application.",
    "",
    "URLs:",
    `- ${config.targetUrl}`,
  ]

  if (config.allowedHostnames?.length) {
    sections.push("", "Allowed hostnames:", ...config.allowedHostnames.map((hostname) => `- ${hostname}`))
  }

  sections.push(
    "",
    "Scan configuration:",
    `- Scope mode: ${config.scopeMode}`,
    `- Aggressiveness: ${config.aggressiveness}`,
    `- Scan mode: ${config.scanMode || "standard"}`
  )

  if (config.maxDepth) {
    sections.push(`- Max depth: ${config.maxDepth}`)
  }

  if (config.maxAgents) {
    sections.push(`- Max agents: ${config.maxAgents}`)
  }

  if (config.instruction?.trim()) {
    sections.push("", `Special instructions: ${config.instruction.trim()}`)
  }

  sections.push(
    "",
    "Operational requirements:",
    "- Start by calling create_todo to track the scan phases and coverage.",
    "- Do not start with ad hoc curl or wget probes. Use exec_command only when it advances a defined phase.",
    "- Prefer Bloodhunter state tools for scan output: report_endpoint, report_finding, record_note, and finish_scan.",
    "- Load relevant skills before specialized vulnerability testing or tool-heavy workflows.",
    "- Spawn specialized agents only for concrete subtasks that improve coverage or validation."
  )

  return sections.join("\n")
}

export function buildReconSystemPrompt(config: {
  targetUrl: string
  allowedHostnames: string[]
  scopeMode: string
  aggressiveness: string
  existingEvents?: ScanEvent[]
}): string {
  log.debug("PROMPT", "buildReconSystemPrompt() called", { target: config.targetUrl })
  return renderReconPrompt({
    targetUrl: config.targetUrl,
    allowedHostnames: config.allowedHostnames,
    scopeMode: config.scopeMode,
    aggressiveness: config.aggressiveness,
    scanMode: "standard",
    isWhitebox: false,
    isRoot: true,
    interactive: false,
    existingEvents: config.existingEvents,
  })
}
