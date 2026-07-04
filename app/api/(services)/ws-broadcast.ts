import type { ScanEvent } from "@/app/(common-lib)/schemas"
import type { WebSocket } from "ws"
import { log } from "./logger"

// Extend global namespace for WebSocket connections
declare global {
  var __wsConnections: Map<string, Set<WebSocket>> | undefined
}

/**
 * Broadcast a scan event to all WebSocket clients subscribed to a scan.
 * This function accesses the global WebSocket connections map set by server.ts.
 */
export function broadcastScanEvent(scanId: string, event: ScanEvent) {
  const wsConnections = global.__wsConnections
  
  if (!wsConnections) {
    // WebSocket server not initialized (running in dev mode without custom server)
    return
  }

  const scanConnections = wsConnections.get(scanId)
  if (!scanConnections || scanConnections.size === 0) {
    return
  }

  const message = JSON.stringify(event)
  let sent = 0
  let failed = 0

  for (const ws of scanConnections) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(message)
        sent++
      } catch (error) {
        failed++
        log.error("WS", "Failed to broadcast event", undefined, {
          error: error instanceof Error ? error.message : String(error),
          scanId,
          eventType: event.type,
        })
      }
    }
  }

  if (sent > 0) {
    log.debug("WS", `Broadcast ${event.type} to ${sent} client(s)`, {
      scanId,
      sent,
      failed,
    })
  }
}

/**
 * Get the number of active WebSocket connections for a scan.
 */
export function getScanConnectionCount(scanId: string): number {
  const wsConnections = global.__wsConnections
  if (!wsConnections) return 0
  return wsConnections.get(scanId)?.size || 0
}

/**
 * Get the total number of active WebSocket connections across all scans.
 */
export function getTotalConnectionCount(): number {
  const wsConnections = global.__wsConnections
  if (!wsConnections) return 0
  
  let total = 0
  for (const connections of wsConnections.values()) {
    total += connections.size
  }
  return total
}
