import { getMainDb } from "./database"
import type { Scan } from "@/app/(common-lib)/schemas"

export interface CreateScanInput {
  id: string
  userId: string
  targetUrl: string
  scopeMode: string
  aggressiveness: string
  status: string
  instruction?: string
  scanMode?: string
  providerId?: string
  modelId?: string
  maxDepth?: number
  maxAgents?: number
}

export function createScan(input: CreateScanInput): Scan {
  const db = getMainDb()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO scans (
      id, user_id, target_url, scope_mode, aggressiveness, status,
      instruction, scan_mode, provider_id, model_id, max_depth, max_agents,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    input.id,
    input.userId,
    input.targetUrl,
    input.scopeMode,
    input.aggressiveness,
    input.status,
    input.instruction || null,
    input.scanMode || null,
    input.providerId || null,
    input.modelId || null,
    input.maxDepth || null,
    input.maxAgents || null,
    now,
    now
  )

  return getScanById(input.id)!
}

interface ScanRow {
  id: string
  user_id: string
  target_url: string
  scope_mode: string
  aggressiveness: string
  status: string
  instruction: string | null
  scan_mode: string | null
  provider_id: string | null
  model_id: string | null
  max_depth: number | null
  max_agents: number | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export function getScanById(id: string): Scan | null {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT 
      id,
      user_id,
      target_url,
      scope_mode,
      aggressiveness,
      status,
      instruction,
      scan_mode,
      provider_id,
      model_id,
      max_depth,
      max_agents,
      created_at,
      updated_at,
      started_at,
      completed_at
    FROM scans
    WHERE id = ?
  `)

  const row = stmt.get(id) as ScanRow | undefined
  if (!row) return null

  return {
    id: row.id,
    userId: row.user_id,
    config: {
      targetUrl: row.target_url,
      scopeMode: row.scope_mode as Scan["config"]["scopeMode"],
      aggressiveness: row.aggressiveness as Scan["config"]["aggressiveness"],
      instruction: row.instruction || undefined,
      scanMode: (row.scan_mode as Scan["config"]["scanMode"]) || undefined,
      providerId: row.provider_id || undefined,
      modelId: row.model_id || undefined,
      maxDepth: row.max_depth || undefined,
      maxAgents: row.max_agents || undefined,
    },
    status: row.status as Scan["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
  }
}

export function getAllScans(userId: string): Scan[] {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT 
      id,
      user_id,
      target_url,
      scope_mode,
      aggressiveness,
      status,
      instruction,
      scan_mode,
      provider_id,
      model_id,
      max_depth,
      max_agents,
      created_at,
      updated_at,
      started_at,
      completed_at
    FROM scans
    WHERE user_id = ?
    ORDER BY created_at DESC
  `)

  const rows = stmt.all(userId) as ScanRow[]
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    config: {
      targetUrl: row.target_url,
      scopeMode: row.scope_mode as Scan["config"]["scopeMode"],
      aggressiveness: row.aggressiveness as Scan["config"]["aggressiveness"],
      instruction: row.instruction || undefined,
      scanMode: (row.scan_mode as Scan["config"]["scanMode"]) || undefined,
      providerId: row.provider_id || undefined,
      modelId: row.model_id || undefined,
      maxDepth: row.max_depth || undefined,
      maxAgents: row.max_agents || undefined,
    },
    status: row.status as Scan["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
  }))
}

export function updateScanStatus(
  id: string,
  status: string,
  startedAt?: string,
  completedAt?: string
): Scan | null {
  const db = getMainDb()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    UPDATE scans
    SET status = ?, updated_at = ?, started_at = ?, completed_at = ?
    WHERE id = ?
  `)

  stmt.run(status, now, startedAt || null, completedAt || null, id)

  return getScanById(id)
}

export function deleteScan(id: string): boolean {
  const db = getMainDb()
  const stmt = db.prepare("DELETE FROM scans WHERE id = ?")
  const result = stmt.run(id)
  return result.changes > 0
}
