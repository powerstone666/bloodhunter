import { getMainDb } from "./database"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ScanEventRow {
  event_type: string
  event_data: string
  timestamp: string
}

export interface CreateScanEventInput {
  scanId: string
  eventType: string
  eventData: Record<string, unknown>
  timestamp: string
}

export function createScanEvent(input: CreateScanEventInput): void {
  const db = getMainDb()
  const stmt = db.prepare(`
    INSERT INTO scan_events (scan_id, event_type, event_data, timestamp)
    VALUES (?, ?, ?, ?)
  `)

  stmt.run(
    input.scanId,
    input.eventType,
    JSON.stringify(input.eventData),
    input.timestamp
  )
}

export function getScanEvents(scanId: string): ScanEvent[] {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT event_type, event_data, timestamp
    FROM scan_events
    WHERE scan_id = ?
    ORDER BY timestamp ASC, id ASC
  `)

  const rows = stmt.all(scanId) as ScanEventRow[]
  return rows.map(row => {
    const eventData = JSON.parse(row.event_data)
    return {
      type: row.event_type,
      scanId: scanId,
      timestamp: row.timestamp,
      ...eventData,
    } as ScanEvent
  })
}

export function deleteScanEvents(scanId: string): boolean {
  const db = getMainDb()
  const stmt = db.prepare("DELETE FROM scan_events WHERE scan_id = ?")
  const result = stmt.run(scanId)
  return result.changes > 0
}
