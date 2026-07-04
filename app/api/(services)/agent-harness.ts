/**
 * AgentHarness — manages the agent execution loop.
 * 
 * Ported from Strix's execution.py + runner.py.
 * Key features:
 * 
 * 1. Proper execution loop with error recovery
 * 2. Image stripping on 400/404/422 (model rejects images)
 * 3. Lifecycle termination via finish_scan/agent_finish
 * 4. Sandbox passed to tools for command execution
 * 5. Proper cleanup on completion/failure
 * 6. Multi-agent coordination via AgentCoordinator
 * 7. Live event streaming via LiveView
 * 8. Resume support via coordinator snapshots
 */

import { createDeepAgent } from "deepagents"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { renderReconPrompt } from "./prompt-renderer"
import { DockerSandbox, getOrCreateSandbox, cleanupSandbox } from "./docker-sandbox"
import { log } from "./logger"
import { AgentCoordinator } from "./agent-coordinator"
import { LiveView } from "./live-view"
import { ImageStripper, createImageStripper, type SessionItem } from "./image-stripper"
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
  initialTask?: string
  onEvent: (event: ScanEvent) => void
  abortSignal?: AbortSignal
  fetchFn?: typeof fetch
  sandbox?: DockerSandbox
  coordinator?: AgentCoordinator
  liveView?: LiveView
  resume?: boolean
  snapshotPath?: string
}

export interface AgentRunResult {
  success: boolean
  output: string
  events: ScanEvent[]
  coordinator?: AgentCoordinator
  liveView?: LiveView
}

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  fetchFn?: typeof fetch
  userId: string
  abortController?: AbortController
  sandbox?: DockerSandbox
  coordinator?: AgentCoordinator
  liveView?: LiveView
}

export class AgentHarness {
  private events: ScanEvent[] = []
  private readonly ctx: ToolContext
  private coordinator?: AgentCoordinator
  private liveView?: LiveView
  private imageStripper: ImageStripper

  constructor(
    private readonly scanId: string,
    private readonly agentId: string,
    private readonly userId: string,
    private readonly onEvent: (event: ScanEvent) => void,
    fetchFn: typeof fetch = fetch,
    sandbox?: DockerSandbox,
    coordinator?: AgentCoordinator,
    liveView?: LiveView
  ) {
    log.info("AGENT", "AgentHarness constructed", { scanId, agentId, userId, sandbox: sandbox ? "docker" : "host" })
    this.ctx = {
      scanId,
      agentId,
      emitEvent: (event) => this.emitEvent(event),
      fetchFn,
      userId,
      sandbox,
      coordinator,
      liveView,
    }
    this.coordinator = coordinator
    this.liveView = liveView
    this.imageStripper = createImageStripper()
  }

  private emitEvent(event: ScanEvent): void {
    this.events.push(event)
    this.onEvent(event)
    
    // Stream event to LiveView if available
    if (this.liveView) {
      this.liveView.ingestSdkEvent(this.agentId, event)
    }
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

    // Register agent with coordinator if available
    if (this.coordinator) {
      await this.coordinator.register(this.agentId, "Security Agent", null, {
        task: config.initialTask || "Security scan",
      })
      log.debug("AGENT", "Agent registered with coordinator")
    }

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

    const messages = [
      {
        role: "user" as const,
        content: config.initialTask || `You MUST start working immediately by calling tools. Do NOT just describe what you plan to do - actually DO it.

Your first action MUST be a tool call. Start with:
1. Call exec_command to run: curl -sI ${config.systemPrompt.includes("Target:") ? "the target URL" : "the target"} to get initial headers
2. Call exec_command to run reconnaissance tools (subfinder, httpx, katana, nmap, etc.)
3. Use report_endpoint for every URL you discover
4. Use report_finding for every vulnerability you confirm
5. Call finish_scan ONLY when you have exhausted all testing

BEGIN NOW with your first tool call.`,
      },
    ]

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

      let result
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts) {
        try {
          // Use streaming to capture intermediate events
          const stream = await agent.stream({
            messages,
          })

          // Process stream events
          for await (const event of stream) {
            // Capture all stream events for the LiveView
            if (this.liveView) {
              this.liveView.ingestSdkEvent(this.agentId, event)
            }

            // Emit thinking events for agent reasoning
            if ((event as any).type === "agent" && (event as any).snapshot?.messages) {
              const lastMessage = (event as any).snapshot.messages[(event as any).snapshot.messages.length - 1]
              if (lastMessage?.role === "assistant" && lastMessage.content) {
                const content = typeof lastMessage.content === "string" 
                  ? lastMessage.content 
                  : JSON.stringify(lastMessage.content)
                
                if (content && content.length > 0) {
                  this.emitEvent({
                    type: "agent.thinking",
                    scanId: this.scanId,
                    agentId: this.agentId,
                    thought: content,
                    timestamp: new Date().toISOString(),
                  })
                }
              }
            }

            // Emit tool call events
            if ((event as any).type === "tool" && (event as any).snapshot?.messages) {
              const lastMessage = (event as any).snapshot.messages[(event as any).snapshot.messages.length - 1]
              if (lastMessage?.role === "tool") {
                const toolCall = lastMessage.tool_calls?.[0]
                if (toolCall) {
                  this.emitEvent({
                    type: "tool.called",
                    scanId: this.scanId,
                    agentId: this.agentId,
                    toolName: toolCall.name,
                    summary: `Calling ${toolCall.name}`,
                    input: toolCall.args as Record<string, unknown>,
                    timestamp: new Date().toISOString(),
                  })
                }
              }
            }

            // Emit tool result events
            if ((event as any).type === "tool" && (event as any).snapshot?.messages) {
              const messages = (event as any).snapshot.messages
              const lastMessage = messages[messages.length - 1]
              if (lastMessage?.role === "tool" && lastMessage.content) {
                const toolCall = lastMessage.tool_calls?.[0]
                if (toolCall) {
                  this.emitEvent({
                    type: "tool.result",
                    scanId: this.scanId,
                    agentId: this.agentId,
                    toolName: toolCall.name,
                    result: typeof lastMessage.content === "string" 
                      ? { output: lastMessage.content.substring(0, 5000) }
                      : { output: JSON.stringify(lastMessage.content).substring(0, 5000) },
                    timestamp: new Date().toISOString(),
                  })
                }
              }
            }
          }

          // Get final result from the stream
          result = stream
          break
        } catch (error) {
          attempts++
          
          if (this.imageStripper.shouldStripImages(error) && this.imageStripper.hasAttempts()) {
            log.warn("AGENT", "API rejection detected, stripping images from session", {
              attempt: attempts,
              error: error instanceof Error ? error.message : String(error),
            })

            const stripResult = this.imageStripper.stripImagesFromSession(messages as SessionItem[])
            
            if (stripResult.stripped) {
              log.info("AGENT", "Images stripped from session", {
                itemCount: stripResult.itemCount,
                imageCount: stripResult.imageCount,
              })
              
              continue
            }
          }

          throw error
        }
      }

      log.stopTimer("deepagent-run", "AGENT")

      // Extract the final output from the stream's final state
      const finalState = result?.snapshot || result?.finalState || {}
      const finalMessages = finalState.messages || []
      const output = finalMessages.length > 0 
        ? (typeof finalMessages[finalMessages.length - 1]?.content === "string" 
            ? finalMessages[finalMessages.length - 1].content 
            : JSON.stringify(finalMessages[finalMessages.length - 1]?.content || ""))
        : ""
      const messageCount = finalMessages.length

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

      // Update coordinator status if available
      if (this.coordinator) {
        await this.coordinator.setStatus(this.agentId, "completed")
      }

      return { 
        success: true, 
        output: typeof output === "string" ? output : JSON.stringify(output), 
        events: this.events,
        coordinator: this.coordinator,
        liveView: this.liveView,
      }
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

        if (this.coordinator) {
          await this.coordinator.setStatus(this.agentId, "completed")
        }

        return { 
          success: true, 
          output: "Agent finished via finish_scan or agent_finish", 
          events: this.events,
          coordinator: this.coordinator,
          liveView: this.liveView,
        }
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

      if (this.coordinator) {
        await this.coordinator.setStatus(this.agentId, "failed")
      }

      return { 
        success: false, 
        output: errorMessage, 
        events: this.events,
        coordinator: this.coordinator,
        liveView: this.liveView,
      }
    }
  }
}

export async function runAgent(config: AgentConfig): Promise<AgentRunResult> {
  log.info("AGENT", "runAgent() called", { scanId: config.scanId, agentId: config.agentId })
  
  // Get or create sandbox (with caching)
  let sandbox = config.sandbox
  if (!sandbox) {
    log.info("AGENT", "No sandbox provided, getting or creating one...")
    try {
      sandbox = await getOrCreateSandbox({
        scanId: config.scanId,
        agentId: config.agentId,
        targetUrl: "",  // Will be set from scan config
      })
      log.success("AGENT", "Sandbox ready", { containerId: sandbox.getContainerId()?.substring(0, 12) })
    } catch (error) {
      log.warn("AGENT", "Sandbox creation failed, falling back to host execution", undefined, {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // Create or use provided coordinator
  let coordinator = config.coordinator
  if (!coordinator) {
    coordinator = new AgentCoordinator()
    if (config.snapshotPath) {
      coordinator.setSnapshotPath(config.snapshotPath)
      
      // Try to load snapshot if resuming
      if (config.resume) {
        const loaded = await coordinator.loadSnapshot()
        if (loaded) {
          log.info("AGENT", "Coordinator snapshot loaded", { scanId: config.scanId })
        }
      }
    }
    log.debug("AGENT", "Coordinator created", { resume: config.resume || false })
  }

  // Create or use provided LiveView
  let liveView = config.liveView
  if (!liveView) {
    liveView = new LiveView()
    log.debug("AGENT", "LiveView created")
  }

  const harness = new AgentHarness(
    config.scanId,
    config.agentId,
    config.userId,
    config.onEvent,
    config.fetchFn,
    sandbox,
    coordinator,
    liveView
  )

  try {
    return await harness.run({
      userId: config.userId,
      model: config.model,
      systemPrompt: config.systemPrompt,
      initialTask: config.initialTask,
      abortSignal: config.abortSignal,
      sandbox: config.sandbox,
      coordinator,
      liveView,
      resume: config.resume,
      snapshotPath: config.snapshotPath,
    })
  } finally {
    // Save coordinator snapshot
    if (coordinator && config.snapshotPath) {
      log.debug("AGENT", "Saving coordinator snapshot...")
      // Snapshot is saved automatically by coordinator
    }

    // Cleanup sandbox on completion (if we created it)
    if (sandbox && !config.sandbox) {
      log.info("AGENT", "Cleaning up sandbox...")
      await cleanupSandbox(config.scanId)
    }
  }
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

export function buildRootScanTask(scanConfig: {
  targetUrl: string
  scopeMode: string
  aggressiveness: string
  scanMode?: string
  instruction?: string
  allowedHostnames?: string[]
}): string {
  const parts: string[] = []
  
  parts.push(`Target: ${scanConfig.targetUrl}`)
  parts.push(`Scope: ${scanConfig.scopeMode}`)
  parts.push(`Aggressiveness: ${scanConfig.aggressiveness}`)
  
  if (scanConfig.scanMode) {
    parts.push(`Scan Mode: ${scanConfig.scanMode}`)
  }
  
  if (scanConfig.allowedHostnames && scanConfig.allowedHostnames.length > 0) {
    parts.push(`Allowed Hostnames: ${scanConfig.allowedHostnames.join(", ")}`)
  }
  
  if (scanConfig.instruction) {
    parts.push(`\nUser Instructions:\n${scanConfig.instruction}`)
  }
  
  parts.push(`\nBegin the security scan. Start with reconnaissance and report your findings.`)
  
  return parts.join("\n")
}
