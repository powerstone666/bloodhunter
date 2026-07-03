import { getMainDb } from "./database"
import type { Agent } from "@/app/(common-lib)/schemas"

interface AgentRow {
  id: string
  scan_id: string
  parent_id: string | null
  name: string
  status: string
  created_at: string
  completed_at: string | null
}

export interface CreateAgentInput {
  id: string
  scanId: string
  parentId?: string
  name: string
  status?: string
}

export function createAgent(input: CreateAgentInput): Agent {
  const db = getMainDb()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO agents (id, scan_id, parent_id, name, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    input.id,
    input.scanId,
    input.parentId || null,
    input.name,
    input.status || "running",
    now
  )

  return getAgentById(input.id)!
}

export function getAgentById(id: string): Agent | null {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT id, scan_id, parent_id, name, status, created_at, completed_at
    FROM agents
    WHERE id = ?
  `)

  const row = stmt.get(id) as AgentRow | undefined
  if (!row) return null

  return {
    id: row.id,
    scanId: row.scan_id,
    parentId: row.parent_id || undefined,
    name: row.name,
    status: row.status as Agent["status"],
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  }
}

export function getAgentsByScanId(scanId: string): Agent[] {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT id, scan_id, parent_id, name, status, created_at, completed_at
    FROM agents
    WHERE scan_id = ?
    ORDER BY created_at ASC
  `)

  const rows = stmt.all(scanId) as AgentRow[]
  return rows.map(row => ({
    id: row.id,
    scanId: row.scan_id,
    parentId: row.parent_id || undefined,
    name: row.name,
    status: row.status as Agent["status"],
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  }))
}

export function updateAgentStatus(
  id: string,
  status: string,
  completedAt?: string
): Agent | null {
  const db = getMainDb()
  const stmt = db.prepare(`
    UPDATE agents
    SET status = ?, completed_at = ?
    WHERE id = ?
  `)

  stmt.run(status, completedAt || null, id)
  return getAgentById(id)
}

export function deleteAgent(id: string): boolean {
  const db = getMainDb()
  const stmt = db.prepare("DELETE FROM agents WHERE id = ?")
  const result = stmt.run(id)
  return result.changes > 0
}
