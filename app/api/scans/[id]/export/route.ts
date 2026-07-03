import { NextResponse } from "next/server"
import { getScanById } from "@/app/api/(db)/scans-repository"
import { getVulnerabilitiesByScanId } from "@/app/api/(db)/vulnerabilities-repository"
import { getEndpointsByScanId } from "@/app/api/(db)/endpoints-repository"
import { getScanEvents } from "@/app/api/(db)/scan-events-repository"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(request.url)
  const format = url.searchParams.get("format") || "json"

  const scan = getScanById(id)
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 })
  }

  const vulns = getVulnerabilitiesByScanId(id)
  const endpoints = getEndpointsByScanId(id)
  const events = getScanEvents(id)

  const report = {
    scan: {
      id: scan.id,
      target: scan.config.targetUrl,
      scope: scan.config.scopeMode,
      aggressiveness: scan.config.aggressiveness,
      status: scan.status,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
    },
    summary: {
      totalFindings: vulns.length,
      critical: vulns.filter(v => v.severity === "critical").length,
      high: vulns.filter(v => v.severity === "high").length,
      medium: vulns.filter(v => v.severity === "medium").length,
      low: vulns.filter(v => v.severity === "low").length,
      info: vulns.filter(v => v.severity === "info").length,
      totalEndpoints: endpoints.length,
    },
    vulnerabilities: vulns.map(v => ({
      id: v.id,
      title: v.title,
      severity: v.severity,
      confidence: v.confidence,
      status: v.status,
      endpoint: v.endpoint,
      method: v.method,
      description: v.description,
      evidence: v.evidence,
      remediation: v.remediation,
      createdAt: v.createdAt,
    })),
    endpoints: endpoints.map(e => ({
      url: e.url,
      method: e.method,
      statusCode: e.statusCode,
      contentType: e.contentType,
      title: e.title,
      technologies: e.technologies,
    })),
    events: events.map(e => ({
      type: e.type,
      timestamp: e.timestamp,
      data: e,
    })),
  }

  if (format === "markdown") {
    const md = generateMarkdown(report)
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="bloodhunter-report-${id}.md"`,
      },
    })
  }

  return NextResponse.json(report, {
    headers: {
      "Content-Disposition": `attachment; filename="bloodhunter-report-${id}.json"`,
    },
  })
}

interface ReportData {
  scan: {
    id: string
    target: string
    scope: string
    aggressiveness: string
    status: string
    createdAt: string
    completedAt?: string
  }
  summary: {
    totalFindings: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
    totalEndpoints: number
  }
  vulnerabilities: Array<{
    id: string
    title: string
    severity: string
    confidence: string
    status: string
    endpoint: string
    method?: string
    description: string
    evidence: string
    remediation?: string
    createdAt: string
  }>
  endpoints: Array<{
    url: string
    method: string
    statusCode?: number | null
    contentType?: string | null
    title?: string | null
    technologies?: string | null
  }>
}

function generateMarkdown(report: ReportData): string {
  const { scan, summary, vulnerabilities, endpoints } = report

  let md = `# Bloodhunter Security Report\n\n`
  md += `## Scan Information\n\n`
  md += `- **Target**: ${scan.target}\n`
  md += `- **Scope**: ${scan.scope}\n`
  md += `- **Aggressiveness**: ${scan.aggressiveness}\n`
  md += `- **Status**: ${scan.status}\n`
  md += `- **Created**: ${scan.createdAt}\n`
  if (scan.completedAt) md += `- **Completed**: ${scan.completedAt}\n`
  md += `\n`

  md += `## Summary\n\n`
  md += `| Severity | Count |\n|----------|-------|\n`
  md += `| Critical | ${summary.critical} |\n`
  md += `| High | ${summary.high} |\n`
  md += `| Medium | ${summary.medium} |\n`
  md += `| Low | ${summary.low} |\n`
  md += `| Info | ${summary.info} |\n`
  md += `| **Total** | **${summary.totalFindings}** |\n\n`

  md += `## Endpoints (${summary.totalEndpoints})\n\n`
  for (const ep of endpoints) {
    md += `- \`${ep.method} ${ep.url}\` → ${ep.statusCode || "?"}\n`
  }
  md += `\n`

  if (vulnerabilities.length > 0) {
    md += `## Vulnerabilities\n\n`
    for (const v of vulnerabilities) {
      md += `### ${v.title}\n\n`
      md += `- **Severity**: ${v.severity.toUpperCase()}\n`
      md += `- **Confidence**: ${v.confidence}\n`
      md += `- **Endpoint**: ${v.method || "GET"} ${v.endpoint}\n`
      md += `- **Status**: ${v.status}\n\n`
      md += `**Description**: ${v.description}\n\n`
      md += `**Evidence**:\n\`\`\`\n${v.evidence}\n\`\`\`\n\n`
      if (v.remediation) {
        md += `**Remediation**: ${v.remediation}\n\n`
      }
      md += `---\n\n`
    }
  }

  return md
}
