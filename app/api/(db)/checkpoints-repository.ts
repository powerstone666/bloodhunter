import { getMainDb } from "./database"

export interface Checkpoint {
  id: string
  scanId: string
  phase: string
  agentId: string | null
  stepNumber: number
  data: string | null
  createdAt: string
}

export interface CreateCheckpointInput {
  scanId: string
  phase: string
  agentId?: string
  stepNumber?: number
  data?: string
}

export function createCheckpoint(input: CreateCheckpointInput): Checkpoint {
  const db = getMainDb()
  const id = `cp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO checkpoints (id, scan_id, phase, agent_id, step_number, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.scanId, input.phase, input.agentId || null, input.stepNumber || 0, input.data || null, now)

  return getCheckpoint(id)!
}

export function getCheckpoint(id: string): Checkpoint | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return mapRow(row)
}

export function getLatestCheckpoint(scanId: string): Checkpoint | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM checkpoints WHERE scan_id = ? ORDER BY step_number DESC, created_at DESC LIMIT 1").get(scanId) as Record<string, unknown> | undefined
  if (!row) return null
  return mapRow(row)
}

export function getCheckpointsByScanId(scanId: string): Checkpoint[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM checkpoints WHERE scan_id = ? ORDER BY step_number ASC, created_at ASC").all(scanId) as Array<Record<string, unknown>>
  return rows.map(mapRow)
}

export function deleteCheckpointsByScanId(scanId: string): void {
  const db = getMainDb()
  db.prepare("DELETE FROM checkpoints WHERE scan_id = ?").run(scanId)
}

function mapRow(row: Record<string, unknown>): Checkpoint {
  return {
    id: row.id as string,
    scanId: row.scan_id as string,
    phase: row.phase as string,
    agentId: row.agent_id as string | null,
    stepNumber: row.step_number as number,
    data: row.data as string | null,
    createdAt: row.created_at as string,
  }
}
