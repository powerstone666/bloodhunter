import { getMainDb } from "./database"
import type { Vulnerability } from "@/app/(common-lib)/schemas"

interface VulnerabilityRow {
  id: string
  scan_id: string
  title: string
  severity: string
  endpoint: string
  method: string | null
  description: string
  evidence: string
  remediation: string | null
  confidence: string
  status: string
  created_at: string
}

export interface CreateVulnerabilityInput {
  id: string
  scanId: string
  title: string
  severity: string
  endpoint: string
  method?: string
  description: string
  evidence: string
  remediation?: string
  confidence: string
  status?: string
}

export function createVulnerability(input: CreateVulnerabilityInput): Vulnerability {
  const db = getMainDb()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO vulnerabilities (
      id, scan_id, title, severity, endpoint, method,
      description, evidence, remediation, confidence, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    input.id,
    input.scanId,
    input.title,
    input.severity,
    input.endpoint,
    input.method || null,
    input.description,
    input.evidence,
    input.remediation || null,
    input.confidence,
    input.status || "new",
    now
  )

  return getVulnerabilityById(input.id)!
}

export function getVulnerabilityById(id: string): Vulnerability | null {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT 
      id, scan_id, title, severity, endpoint, method,
      description, evidence, remediation, confidence, status, created_at
    FROM vulnerabilities
    WHERE id = ?
  `)

  const row = stmt.get(id) as VulnerabilityRow | undefined
  if (!row) return null

  return {
    id: row.id,
    scanId: row.scan_id,
    title: row.title,
    severity: row.severity as Vulnerability["severity"],
    endpoint: row.endpoint,
    method: row.method || undefined,
    description: row.description,
    evidence: row.evidence,
    remediation: row.remediation || undefined,
    confidence: row.confidence as Vulnerability["confidence"],
    status: row.status as Vulnerability["status"],
    createdAt: row.created_at,
  }
}

export function getVulnerabilitiesByScanId(scanId: string): Vulnerability[] {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT 
      id, scan_id, title, severity, endpoint, method,
      description, evidence, remediation, confidence, status, created_at
    FROM vulnerabilities
    WHERE scan_id = ?
    ORDER BY created_at DESC
  `)

  const rows = stmt.all(scanId) as VulnerabilityRow[]
  return rows.map(row => ({
    id: row.id,
    scanId: row.scan_id,
    title: row.title,
    severity: row.severity as Vulnerability["severity"],
    endpoint: row.endpoint,
    method: row.method || undefined,
    description: row.description,
    evidence: row.evidence,
    remediation: row.remediation || undefined,
    confidence: row.confidence as Vulnerability["confidence"],
    status: row.status as Vulnerability["status"],
    createdAt: row.created_at,
  }))
}

export function updateVulnerabilityStatus(
  id: string,
  status: string
): Vulnerability | null {
  const db = getMainDb()
  const stmt = db.prepare(`
    UPDATE vulnerabilities
    SET status = ?
    WHERE id = ?
  `)

  stmt.run(status, id)
  return getVulnerabilityById(id)
}

export function deleteVulnerability(id: string): boolean {
  const db = getMainDb()
  const stmt = db.prepare("DELETE FROM vulnerabilities WHERE id = ?")
  const result = stmt.run(id)
  return result.changes > 0
}
