import { getMainDb } from "./database"

export interface Endpoint {
  id: string
  scanId: string
  url: string
  method: string
  statusCode: number | null
  contentType: string | null
  title: string | null
  technologies: string | null
  headers: string | null
  discoveredAt: string
}

export interface CreateEndpointInput {
  scanId: string
  url: string
  method?: string
  statusCode?: number | null
  contentType?: string | null
  title?: string | null
  technologies?: string | null
  headers?: string | null
}

export function createEndpoint(input: CreateEndpointInput): Endpoint {
  const db = getMainDb()
  const id = `ep-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

  const stmt = db.prepare(`
    INSERT INTO endpoints (id, scan_id, url, method, status_code, content_type, title, technologies, headers, discovered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  stmt.run(
    id,
    input.scanId,
    input.url,
    input.method || "GET",
    input.statusCode ?? null,
    input.contentType ?? null,
    input.title ?? null,
    input.technologies ?? null,
    input.headers ?? null,
    now
  )

  return getEndpoint(id)!
}

export function getEndpoint(id: string): Endpoint | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM endpoints WHERE id = ?").get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return mapRow(row)
}

export function getEndpointsByScanId(scanId: string): Endpoint[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM endpoints WHERE scan_id = ? ORDER BY discovered_at ASC").all(scanId) as Array<Record<string, unknown>>
  return rows.map(mapRow)
}

export function deleteEndpointsByScanId(scanId: string): void {
  const db = getMainDb()
  db.prepare("DELETE FROM endpoints WHERE scan_id = ?").run(scanId)
}

function mapRow(row: Record<string, unknown>): Endpoint {
  return {
    id: row.id as string,
    scanId: row.scan_id as string,
    url: row.url as string,
    method: row.method as string,
    statusCode: row.status_code as number | null,
    contentType: row.content_type as string | null,
    title: row.title as string | null,
    technologies: row.technologies as string | null,
    headers: row.headers as string | null,
    discoveredAt: row.discovered_at as string,
  }
}
