import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import type { Vulnerability } from "@/app/(common-lib)/schemas"
import { log } from "./logger"

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

export interface ReportWriterConfig {
  runDir: string
  scanId: string
}

export class ReportWriter {
  private runDir: string
  private scanId: string
  private savedVulnIds = new Set<string>()

  constructor(config: ReportWriterConfig) {
    this.runDir = config.runDir
    this.scanId = config.scanId
  }

  async writeVulnerabilities(vulnerabilities: Vulnerability[]): Promise<number> {
    const vulnDir = path.join(this.runDir, "vulnerabilities")
    
    if (!existsSync(vulnDir)) {
      await mkdir(vulnDir, { recursive: true })
    }

    const newReports = vulnerabilities.filter(v => !this.savedVulnIds.has(v.id))
    let newCount = 0

    for (const vuln of newReports) {
      const mdContent = this.renderVulnerabilityMd(vuln)
      const mdPath = path.join(vulnDir, `${vuln.id}.md`)
      await writeFile(mdPath, mdContent, "utf-8")
      this.savedVulnIds.add(vuln.id)
      newCount++
    }

    // Write combined JSON
    const jsonPath = path.join(this.runDir, "vulnerabilities.json")
    await writeFile(jsonPath, JSON.stringify(vulnerabilities, null, 2), "utf-8")

    // Write CSV index
    const csvPath = path.join(this.runDir, "vulnerabilities.csv")
    const csvContent = this.renderCsv(vulnerabilities)
    await writeFile(csvPath, csvContent, "utf-8")

    if (newCount > 0) {
      log.info("REPORT", `Saved ${newCount} new vulnerability report(s)`, { vulnDir })
    }
    log.info("REPORT", `Updated vulnerability index`, { csvPath })

    return newCount
  }

  async writeExecutiveReport(finalResult: string): Promise<void> {
    const reportPath = path.join(this.runDir, "penetration_test_report.md")
    const timestamp = new Date().toISOString()
    
    const content = `# Security Penetration Test Report

**Generated:** ${timestamp}

${finalResult}
`
    
    await writeFile(reportPath, content, "utf-8")
    log.info("REPORT", `Saved penetration test report`, { path: reportPath })
  }

  private renderVulnerabilityMd(vuln: Vulnerability): string {
    const lines: string[] = [
      `# ${vuln.title}\n`,
      `**ID:** ${vuln.id}`,
      `**Severity:** ${vuln.severity.toUpperCase()}`,
      `**Found:** ${vuln.createdAt}`,
    ]

    // Metadata
    const metadata: Array<[string, string | undefined]> = [
      ["Target", vuln.endpoint],
      ["Method", vuln.method],
    ]

    for (const [label, value] of metadata) {
      if (value) {
        lines.push(`**${label}:** ${value}`)
      }
    }

    lines.push("")
    lines.push("## Description\n")
    lines.push(vuln.description || "No description provided.")
    lines.push("")

    if (vuln.evidence) {
      lines.push("## Evidence\n")
      lines.push(vuln.evidence)
      lines.push("")
    }

    if (vuln.remediation) {
      lines.push("## Remediation\n")
      lines.push(vuln.remediation)
      lines.push("")
    }

    return lines.join("\n")
  }

  private renderCsv(vulnerabilities: Vulnerability[]): string {
    const sorted = [...vulnerabilities].sort((a, b) => {
      const aOrder = SEVERITY_ORDER[a.severity] ?? 5
      const bOrder = SEVERITY_ORDER[b.severity] ?? 5
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.createdAt.localeCompare(b.createdAt)
    })

    const header = "id,title,severity,timestamp,file"
    const rows = sorted.map(v => {
      const title = v.title.replace(/"/g, '""')
      return `${v.id},"${title}",${v.severity.toUpperCase()},${v.createdAt},vulnerabilities/${v.id}.md`
    })

    return [header, ...rows].join("\n")
  }
}
