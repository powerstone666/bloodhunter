import { nanoid } from "nanoid"
import type { RuntimeBackend } from "./runtime-backend"
import { extractTargetHostnames, isUrlAllowed, type AllowlistConfig } from "./allowlist"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import type { ScanConfig } from "@/app/(common-lib)/schemas"

export interface ScanEngineConfig {
  scanId: string
  config: ScanConfig
  runtime: RuntimeBackend
  onEvent: (event: ScanEvent) => void
}

export interface ScanExecution {
  scanId: string
  abortController: AbortController
  requestCount: number
  findings: ScanFinding[]
}

export interface ScanFinding {
  id: string
  title: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  endpoint: string
  method?: string
  description: string
  evidence: string
  remediation?: string
  confidence: "confirmed" | "likely" | "possible"
}

const activeScans = new Map<string, ScanExecution>()

export function createScanEngine(scanEngineConfig: ScanEngineConfig): ScanExecution {
  const { scanId, config, onEvent } = scanEngineConfig
  const abortController = new AbortController()

  const targetHostnames = extractTargetHostnames(config.targetUrl, config.scopeMode)
  const allowlist: AllowlistConfig = {
    targetHostnames,
    excludedPaths: config.excludedPaths || [],
    maxRequestsPerSecond: getRateLimit(config.aggressiveness),
  }

  const execution: ScanExecution = {
    scanId,
    abortController,
    requestCount: 0,
    findings: [],
  }

  activeScans.set(scanId, execution)

  emitEvent(onEvent, {
    type: "scan.created",
    scanId,
    timestamp: new Date().toISOString(),
  })

  executeScan(execution, scanEngineConfig, allowlist).catch(error => {
    emitEvent(onEvent, {
      type: "scan.failed",
      scanId,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    })
    activeScans.delete(scanId)
  })

  return execution
}

export function cancelScan(scanId: string): boolean {
  const execution = activeScans.get(scanId)
  if (!execution) return false
  execution.abortController.abort()
  activeScans.delete(scanId)
  return true
}

export function getActiveScan(scanId: string): ScanExecution | undefined {
  return activeScans.get(scanId)
}

async function executeScan(
  execution: ScanExecution,
  config: ScanEngineConfig,
  allowlist: AllowlistConfig
): Promise<void> {
  const { scanId, runtime, onEvent } = config

  if (execution.abortController.signal.aborted) return

  emitEvent(onEvent, {
    type: "scan.started",
    scanId,
    timestamp: new Date().toISOString(),
  })

  emitEvent(onEvent, {
    type: "phase.started",
    scanId,
    phase: "setup",
    timestamp: new Date().toISOString(),
  })

  await sleep(100)

  emitEvent(onEvent, {
    type: "phase.completed",
    scanId,
    phase: "setup",
    timestamp: new Date().toISOString(),
  })

  if (execution.abortController.signal.aborted) return

  emitEvent(onEvent, {
    type: "phase.started",
    scanId,
    phase: "recon",
    timestamp: new Date().toISOString(),
  })

  const agentId = nanoid()
  emitEvent(onEvent, {
    type: "agent.spawned",
    scanId,
    agentId,
    name: "Recon Agent",
    timestamp: new Date().toISOString(),
  })

  try {
    const urlCheck = isUrlAllowed(config.config.targetUrl, allowlist)
    if (!urlCheck.allowed) {
      throw new Error(`Target URL blocked: ${urlCheck.reason}`)
    }

    const result = await runtime.fetchUrl({
      url: config.config.targetUrl,
      method: "GET",
      timeout: 15000,
    })

    execution.requestCount++

    emitEvent(onEvent, {
      type: "tool.called",
      scanId,
      agentId,
      toolName: "http_request",
      summary: `Fetched ${config.config.targetUrl} → ${result.status} (${result.elapsedMs}ms)`,
      timestamp: new Date().toISOString(),
    })

    emitEvent(onEvent, {
      type: "agent.log",
      scanId,
      agentId,
      level: "info",
      message: `Received ${result.body.length} bytes from ${config.config.targetUrl}`,
      timestamp: new Date().toISOString(),
    })

    const headers = result.headers
    if (headers["x-powered-by"]) {
      execution.findings.push({
        id: nanoid(),
        title: `Technology detected: ${headers["x-powered-by"]}`,
        severity: "info",
        endpoint: config.config.targetUrl,
        description: `Server reveals technology stack via X-Powered-By header: ${headers["x-powered-by"]}`,
        evidence: `X-Powered-By: ${headers["x-powered-by"]}`,
        confidence: "confirmed",
      })
    }

    if (!headers["strict-transport-security"]) {
      execution.findings.push({
        id: nanoid(),
        title: "Missing HSTS header",
        severity: "medium",
        endpoint: config.config.targetUrl,
        description: "The server does not send a Strict-Transport-Security header",
        evidence: "Header not present in response",
        remediation: "Add Strict-Transport-Security header with max-age of at least 31536000",
        confidence: "confirmed",
      })
    }

    if (!headers["x-content-type-options"]) {
      execution.findings.push({
        id: nanoid(),
        title: "Missing X-Content-Type-Options header",
        severity: "low",
        endpoint: config.config.targetUrl,
        description: "The server does not send an X-Content-Type-Options header",
        evidence: "Header not present in response",
        remediation: "Add X-Content-Type-Options: nosniff header",
        confidence: "confirmed",
      })
    }

    if (!headers["content-security-policy"]) {
      execution.findings.push({
        id: nanoid(),
        title: "Missing Content-Security-Policy header",
        severity: "medium",
        endpoint: config.config.targetUrl,
        description: "The server does not send a Content-Security-Policy header",
        evidence: "Header not present in response",
        remediation: "Implement a Content-Security-Policy header",
        confidence: "confirmed",
      })
    }

    for (const finding of execution.findings) {
      emitEvent(onEvent, {
        type: "finding.created",
        scanId,
        findingId: finding.id,
        title: finding.title,
        severity: finding.severity,
        timestamp: new Date().toISOString(),
      })
    }

    emitEvent(onEvent, {
      type: "agent.log",
      scanId,
      agentId,
      level: "success",
      message: `Recon complete. Found ${execution.findings.length} issues.`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    emitEvent(onEvent, {
      type: "agent.log",
      scanId,
      agentId,
      level: "error",
      message: `Recon failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      timestamp: new Date().toISOString(),
    })
  }

  emitEvent(onEvent, {
    type: "phase.completed",
    scanId,
    phase: "recon",
    timestamp: new Date().toISOString(),
  })

  if (execution.abortController.signal.aborted) return

  emitEvent(onEvent, {
    type: "phase.started",
    scanId,
    phase: "report",
    timestamp: new Date().toISOString(),
  })

  await sleep(50)

  emitEvent(onEvent, {
    type: "phase.completed",
    scanId,
    phase: "report",
    timestamp: new Date().toISOString(),
  })

  emitEvent(onEvent, {
    type: "scan.completed",
    scanId,
    timestamp: new Date().toISOString(),
  })

  activeScans.delete(scanId)
}

function emitEvent(onEvent: (event: ScanEvent) => void, event: ScanEvent): void {
  onEvent(event)
}

function getRateLimit(aggressiveness: string): number {
  switch (aggressiveness) {
    case "passive": return 5
    case "light": return 10
    case "moderate": return 20
    case "aggressive": return 50
    default: return 10
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
