import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { createVulnerability } from "../../(db)/vulnerabilities-repository"
import { findDuplicateVulnerability, redactEvidence } from "../vulnerability-service"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
}

export function createReportFindingTool(ctx: ToolContext) {
  return tool(
    async (input) => {
      const existing = findDuplicateVulnerability(ctx.scanId, input.title, input.endpoint)
      if (existing) {
        return { success: true, findingId: existing.id, title: input.title, severity: input.severity, deduplicated: true }
      }

      const vulnId = `vuln-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      const redactedEvidence = redactEvidence(input.evidence)
      const vuln = createVulnerability({
        id: vulnId,
        scanId: ctx.scanId,
        title: input.title,
        severity: input.severity,
        endpoint: input.endpoint,
        method: input.method || undefined,
        description: input.description,
        evidence: redactedEvidence,
        remediation: input.remediation || undefined,
        confidence: input.confidence,
      })

      ctx.emitEvent({
        type: "finding.created",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        findingId: vuln.id,
        title: input.title,
        severity: input.severity,
        summary: `${input.severity.toUpperCase()}: ${input.title} at ${input.endpoint}`,
        timestamp: new Date().toISOString(),
      })

      return { success: true, findingId: vuln.id, title: input.title, severity: input.severity }
    },
    {
      name: "report_finding",
      description: "Report a security finding or vulnerability discovered during the scan.",
      schema: z.object({
        title: z.string().describe("Short title of the finding"),
        severity: z.enum(["critical", "high", "medium", "low", "info"]).describe("Severity level"),
        endpoint: z.string().describe("Affected URL/endpoint"),
        method: z.string().optional().describe("HTTP method"),
        description: z.string().describe("Detailed description of the finding"),
        evidence: z.string().describe("Evidence supporting the finding"),
        remediation: z.string().optional().describe("Recommended fix"),
        confidence: z.enum(["confirmed", "likely", "possible"]).describe("Confidence level"),
      }),
    }
  )
}
