import { NextResponse } from "next/server"
import { z } from "zod"
import { nanoid } from "nanoid"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getScanById, updateScanStatus } from "@/app/api/(db)/scans-repository"
import { getScanEvents, createScanEvent } from "@/app/api/(db)/scan-events-repository"
import { buildRootScanTask, runAgent } from "@/app/api/(services)/agent-harness"
import { renderSystemPrompt } from "@/app/api/(services)/prompt-renderer"
import { getAllProviders, getProviderApiKey } from "@/app/api/(db)/providers-repository"
import { createAgent, updateAgentStatus } from "@/app/api/(db)/agents-repository"
import { resolveActiveModel } from "@/app/api/(services)/model-registry"
import { checkDockerRunning } from "@/app/api/(services)/docker-manager"
import { createSandbox, DockerSandbox } from "@/app/api/(services)/docker-sandbox"
import { log } from "@/app/api/(services)/logger"
import { runPreflightChecks, formatPreflightErrors, formatPreflightWarnings } from "@/app/api/(services)/preflight"

const agentRequestSchema = z.object({
  instruction: z.string().optional(),
  timeoutMs: z.number().int().positive().max(300000).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  log.banner("🩸 BLOODHUNTER SCAN INITIATED", new Date().toISOString())
  log.startTimer("total-scan")

  // ─── AUTH ───────────────────────────────────────────────────
  log.info("AUTH", "Checking session...")
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    log.error("AUTH", "Unauthorized — no session")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  log.success("AUTH", "Session verified", { userId: session.user.id })

  // ─── LOAD SCAN ──────────────────────────────────────────────
  const { id: scanId } = await params
  log.info("SCAN", "Loading scan from database", { scanId })

  const scan = getScanById(scanId)
  if (!scan) {
    log.error("SCAN", "Scan not found", { scanId })
    return NextResponse.json({ error: "Scan not found" }, { status: 404 })
  }

  if (scan.userId !== session.user.id) {
    log.error("SCAN", "Forbidden — scan belongs to another user", { scanId, ownerId: scan.userId, requesterId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  log.success("SCAN", "Scan loaded", {
    scanId,
    target: scan.config.targetUrl,
    scope: scan.config.scopeMode,
    aggressiveness: scan.config.aggressiveness,
    mode: scan.config.scanMode,
  })

  const existingEvents = getScanEvents(scanId)
  const legacyModelSelection = getLegacyModelSelection(existingEvents)
  const selectedProviderId = scan.config.providerId ?? legacyModelSelection.providerId
  const selectedModelId = scan.config.modelId ?? legacyModelSelection.modelId

  // ─── VALIDATE REQUEST ───────────────────────────────────────
  const body = await request.json()
  const parsed = agentRequestSchema.safeParse(body)

  if (!parsed.success) {
    log.error("SCAN", "Invalid request body", undefined, { issues: parsed.error.issues })
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    )
  }
  log.debug("SCAN", "Request validated", undefined, { instruction: parsed.data.instruction, timeoutMs: parsed.data.timeoutMs })

  // ─── RESOLVE MODEL ──────────────────────────────────────────
  log.startTimer("model-resolution")
  log.info("MODEL", "Resolving active provider and model...")

  const providers = getAllProviders(session.user.id)
  log.debug("MODEL", "Loaded providers from DB", { count: providers.length, names: providers.map(p => p.name) })

  let model: Awaited<ReturnType<typeof resolveActiveModel>>["model"]
  let agentProvider: Awaited<ReturnType<typeof resolveActiveModel>>["provider"]

  try {
    const scanProviders = selectedModelId
      ? providers.map((provider) => {
          if (provider.id !== selectedProviderId) {
            return provider
          }

          return {
            ...provider,
            defaultModel: selectedModelId,
          }
        })
      : providers

    const resolved = await resolveActiveModel(scanProviders, getProviderApiKey, selectedProviderId)
    model = resolved.model
    agentProvider = resolved.provider
    log.stopTimer("model-resolution", "MODEL")
    log.success("MODEL", "Model resolved", {
      provider: agentProvider.name,
      type: agentProvider.provider,
      model: agentProvider.defaultModel,
      baseUrl: agentProvider.baseUrl || "default",
    })
  } catch (e) {
    log.stopTimer("model-resolution", "MODEL")
    log.error("MODEL", "Failed to resolve model", undefined, { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No provider configured" },
      { status: 400 }
    )
  }

  // ─── PREFLIGHT CHECKS ───────────────────────────────────────
  log.divider("PREFLIGHT VALIDATION")
  log.startTimer("preflight")
  log.info("PREFLIGHT", "Running preflight checks...")

  // Create a temporary agent ID for preflight events
  const preflightAgentId = `preflight-${nanoid()}`
  
  const preflightResult = await runPreflightChecks(
    model,
    agentProvider.name,
    {
      onProgress: (stage, message) => {
        createScanEvent({
          scanId,
          eventType: "agent.log",
          eventData: {
            agentId: preflightAgentId,
            level: "info",
            message: `[${stage.toUpperCase()}] ${message}`,
          },
          timestamp: new Date().toISOString(),
        })
      },
      onDockerPull: (progress) => {
        createScanEvent({
          scanId,
          eventType: "agent.log",
          eventData: {
            agentId: preflightAgentId,
            level: "info",
            message: `[DOCKER] ${progress}`,
          },
          timestamp: new Date().toISOString(),
        })
      },
    }
  )

  log.stopTimer("preflight", "PREFLIGHT")

  if (!preflightResult.success) {
    const errorMsg = formatPreflightErrors(preflightResult.errors)
    log.error("PREFLIGHT", "Preflight checks failed", undefined, { errors: preflightResult.errors })
    
    createScanEvent({
      scanId,
      eventType: "scan.failed",
      eventData: {
        error: errorMsg,
        agentId: preflightAgentId,
        provider: agentProvider.name,
        model: agentProvider.defaultModel,
      },
      timestamp: new Date().toISOString(),
    })

    updateScanStatus(scanId, "failed", undefined, new Date().toISOString())

    return NextResponse.json(
      { error: errorMsg, preflightErrors: preflightResult.errors },
      { status: 400 }
    )
  }

  if (preflightResult.warnings.length > 0) {
    const warnMsg = formatPreflightWarnings(preflightResult.warnings)
    log.warn("PREFLIGHT", "Preflight warnings", undefined, { warnings: preflightResult.warnings })
    
    createScanEvent({
      scanId,
      eventType: "agent.log",
      eventData: {
        agentId: preflightAgentId,
        level: "warn",
        message: warnMsg,
      },
      timestamp: new Date().toISOString(),
    })
  }

  log.success("PREFLIGHT", "All preflight checks passed", {
    apiValid: preflightResult.apiValid,
    dockerReady: preflightResult.dockerReady,
    imageReady: preflightResult.imageReady,
  })

  // ─── CREATE AGENT ───────────────────────────────────────────
  const agentId = `agent-${nanoid()}`
  log.info("AGENT", "Creating agent record in DB", { agentId })

  createAgent({
    id: agentId,
    scanId,
    name: "Security Agent",
  })
  log.success("AGENT", "Agent record created", { agentId, scanId })

  updateScanStatus(scanId, "running", new Date().toISOString())
  log.info("SCAN", "Scan status → running")

  // ─── RENDER PROMPT ──────────────────────────────────────────
  log.startTimer("prompt-render")
  log.debug("PROMPT", "Loaded existing events", { count: existingEvents.length })

  const systemPrompt = renderSystemPrompt({
    targetUrl: scan.config.targetUrl,
    allowedHostnames: scan.config.allowedHostnames || [],
    scopeMode: scan.config.scopeMode,
    aggressiveness: scan.config.aggressiveness,
    scanMode: (scan.config.scanMode as "quick" | "standard" | "deep") || "standard",
    isWhitebox: false,
    isRoot: true,
    interactive: false,
    existingEvents,
  })
  log.stopTimer("prompt-render", "PROMPT")
  log.success("PROMPT", "System prompt rendered", { length: systemPrompt.length, chars: `${systemPrompt.length} chars` })

  const initialTask = buildRootScanTask(scan.config)
  log.debug("PROMPT", "Root scan task built", { length: initialTask.length })

  // ─── TIMEOUT SETUP ──────────────────────────────────────────
  const abortController = new AbortController()
  const scanMode = (scan.config.scanMode as string) || "standard"
  const timeoutMs = parsed.data.timeoutMs || ({ quick: 600000, standard: 1800000, deep: 5400000 }[scanMode] ?? 1800000)
  const timeoutId = setTimeout(() => {
    log.warn("SCAN", "Wall-clock timeout reached — aborting agent", { timeoutMs, scanMode })
    abortController.abort()
  }, timeoutMs)
  log.info("SCAN", "Timeout configured", { timeoutMs: `${timeoutMs / 1000}s`, scanMode })

  // ─── DOCKER / SANDBOX ───────────────────────────────────────
  let sandbox: DockerSandbox | undefined = undefined

  try {
    log.divider("DOCKER SANDBOX INITIALIZATION")
    
    if (preflightResult.dockerReady && preflightResult.imageReady) {
      log.startTimer("sandbox-create")
      log.info("SANDBOX", "Creating sandbox container...", { scanId, agentId, target: scan.config.targetUrl })

      try {
        sandbox = await createSandbox({
          scanId,
          agentId,
          targetUrl: scan.config.targetUrl,
        })
        log.stopTimer("sandbox-create", "SANDBOX")
        log.success("SANDBOX", "Sandbox container created and ready", { containerId: sandbox.getContainerId?.() || "unknown" })

        createScanEvent({
          scanId,
          eventType: "agent.log",
          eventData: {
            agentId,
            level: "success",
            message: "Docker sandbox initialized — tools will execute in isolated container",
          },
          timestamp: new Date().toISOString(),
        })
      } catch (sandboxError) {
        log.stopTimer("sandbox-create", "SANDBOX")
        const errMsg = sandboxError instanceof Error ? sandboxError.message : String(sandboxError)
        log.error("SANDBOX", "Sandbox creation failed — blocking scan", undefined, { error: errMsg })

        createScanEvent({
          scanId,
          eventType: "agent.log",
          eventData: {
            agentId,
            level: "error",
            message: `Docker sandbox failed: ${errMsg}. Scan blocked because Docker sandbox is required.`,
          },
          timestamp: new Date().toISOString(),
        })

        throw new Error(`Docker sandbox failed: ${errMsg}`)
      }
    } else {
      throw new Error("Sandbox unavailable after preflight. Scan blocked because Docker sandbox is required.")
    }

    // ─── AGENT EXECUTION ────────────────────────────────────────
    log.divider("AGENT EXECUTION START")
    log.startTimer("agent-run")
    log.info("AGENT", "Invoking DeepAgent...", {
      agentId,
      scanId,
      model: agentProvider.defaultModel,
      provider: agentProvider.provider,
      sandbox: "docker",
    })

    createScanEvent({
      scanId,
      eventType: "agent.log",
      eventData: {
        agentId,
        level: "info",
        message: `Agent starting — provider: ${agentProvider.name} (${agentProvider.provider}), model: ${agentProvider.defaultModel}, sandbox: docker`,
      },
      timestamp: new Date().toISOString(),
    })

    let eventCount = 0
    const result = await runAgent({
      scanId,
      agentId,
      userId: session.user.id,
      model,
      systemPrompt,
      initialTask,
      sandbox,
      onEvent: (event) => {
        eventCount++
        if (eventCount % 10 === 0 || event.type === "scan.completed" || event.type === "scan.failed") {
          log.debug("EVENT", `Event #${eventCount}: ${event.type}`, { agentId })
        }
        createScanEvent({
          scanId,
          eventType: event.type,
          eventData: event as unknown as Record<string, unknown>,
          timestamp: "timestamp" in event ? String((event as Record<string, unknown>).timestamp) : new Date().toISOString(),
        })
      },
      abortSignal: abortController.signal,
    })

    clearTimeout(timeoutId)
    log.stopTimer("agent-run", "AGENT")

    // ─── FINALIZE ───────────────────────────────────────────────
    log.divider("SCAN FINALIZATION")

    if (result.success) {
      log.success("AGENT", "Agent completed successfully", {
        agentId,
        totalEvents: eventCount,
        outputLength: result.output.length,
      })
      updateAgentStatus(agentId, "completed", new Date().toISOString())
      updateScanStatus(scanId, "completed", undefined, new Date().toISOString())
      log.success("SCAN", "Scan marked as completed")
    } else {
      log.warn("AGENT", "Agent finished with failure", {
        agentId,
        totalEvents: eventCount,
        output: result.output.substring(0, 200),
      })
      updateAgentStatus(agentId, "failed", new Date().toISOString())
      updateScanStatus(scanId, "failed", undefined, new Date().toISOString())
      log.warn("SCAN", "Scan marked as failed")
    }

    log.stopTimer("total-scan", "SCAN")
    log.banner(result.success ? "✅ SCAN COMPLETED" : "⚠️  SCAN FAILED", `${eventCount} events | ${agentId}`)

    return NextResponse.json({
      agentId,
      success: result.success,
      output: result.output,
      eventsCount: result.events.length,
    })

  } catch (error) {
    clearTimeout(timeoutId)
    log.stopTimer("agent-run", "AGENT")

    let errorMessage = "Agent failed"
    if (error instanceof Error) {
      errorMessage = error.message
      const cause = (error as Error & { cause?: unknown }).cause
      if (cause instanceof Error) errorMessage = `${errorMessage}: ${cause.message}`
    }

    log.error("AGENT", "Unhandled exception during agent execution", undefined, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
    })

    updateAgentStatus(agentId, "failed", new Date().toISOString())
    updateScanStatus(scanId, "failed", undefined, new Date().toISOString())

    createScanEvent({
      scanId,
      eventType: "scan.failed",
      eventData: { error: errorMessage, agentId, provider: agentProvider.name, model: agentProvider.defaultModel },
      timestamp: new Date().toISOString(),
    })

    log.stopTimer("total-scan", "SCAN")
    log.banner("❌ SCAN CRASHED", errorMessage.substring(0, 80))

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  } finally {
    // ─── CLEANUP ────────────────────────────────────────────────
    if (sandbox) {
      log.info("SANDBOX", "Stopping and removing sandbox container...")
      try {
        await sandbox.stop()
        log.success("SANDBOX", "Sandbox container stopped and removed")
      } catch (stopError) {
        log.error("SANDBOX", "Failed to stop sandbox container", undefined, {
          error: stopError instanceof Error ? stopError.message : String(stopError),
        })
      }
    }
  }
}

function getLegacyModelSelection(events: ReturnType<typeof getScanEvents>): {
  providerId?: string
  modelId?: string
} {
  const createdEvent = events.find((event) => event.type === "scan.created")
  if (!createdEvent) {
    return {}
  }

  const eventData = createdEvent as unknown as Record<string, unknown>
  return {
    providerId: typeof eventData.providerId === "string" ? eventData.providerId : undefined,
    modelId: typeof eventData.model === "string" ? eventData.model : undefined,
  }
}
