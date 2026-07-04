import { WebSocketServer, WebSocket } from "ws"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { log } from "./logger"

class WebSocketBroadcaster {
  private wss: WebSocketServer | null = null
  private connections = new Map<string, Set<WebSocket>>() // scanId -> Set<WebSocket>

  start(port: number = 8080) {
    if (this.wss) {
      log.warn("WS", "WebSocket server already running")
      return
    }

    this.wss = new WebSocketServer({ port })
    log.success("WS", `WebSocket server started on port ${port}`)

    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url || "", `http://localhost:${port}`)
      const scanId = url.searchParams.get("scanId")

      if (!scanId) {
        log.warn("WS", "Connection without scanId, closing")
        ws.close(1008, "Missing scanId parameter")
        return
      }

      log.info("WS", `Client connected for scan ${scanId}`)

      // Add to connections map
      if (!this.connections.has(scanId)) {
        this.connections.set(scanId, new Set())
      }
      this.connections.get(scanId)!.add(ws)

      // Handle disconnection
      ws.on("close", () => {
        log.info("WS", `Client disconnected from scan ${scanId}`)
        const scanConnections = this.connections.get(scanId)
        if (scanConnections) {
          scanConnections.delete(ws)
          if (scanConnections.size === 0) {
            this.connections.delete(scanId)
          }
        }
      })

      ws.on("error", (error) => {
        log.error("WS", `WebSocket error for scan ${scanId}`, undefined, {
          error: error.message,
        })
      })

      // Send welcome message
      ws.send(JSON.stringify({
        type: "connected",
        scanId,
        timestamp: new Date().toISOString(),
      }))
    })

    this.wss.on("error", (error) => {
      log.error("WS", "WebSocket server error", undefined, { error: error.message })
    })
  }

  broadcast(scanId: string, event: ScanEvent) {
    const scanConnections = this.connections.get(scanId)
    if (!scanConnections || scanConnections.size === 0) {
      return
    }

    const message = JSON.stringify(event)
    let sent = 0
    let failed = 0

    for (const ws of scanConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message)
          sent++
        } catch (error) {
          failed++
          log.error("WS", "Failed to send message", undefined, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    if (sent > 0) {
      log.debug("WS", `Broadcast event to ${sent} clients`, {
        scanId,
        eventType: event.type,
        sent,
        failed,
      })
    }
  }

  getConnectionCount(scanId: string): number {
    return this.connections.get(scanId)?.size || 0
  }

  getTotalConnections(): number {
    let total = 0
    for (const connections of this.connections.values()) {
      total += connections.size
    }
    return total
  }

  stop() {
    if (!this.wss) return

    log.info("WS", "Stopping WebSocket server")
    
    // Close all connections
    for (const [scanId, connections] of this.connections) {
      for (const ws of connections) {
        ws.close(1001, "Server shutting down")
      }
    }
    this.connections.clear()

    this.wss.close(() => {
      log.success("WS", "WebSocket server stopped")
      this.wss = null
    })
  }
}

// Singleton instance
export const wsBroadcaster = new WebSocketBroadcaster()
