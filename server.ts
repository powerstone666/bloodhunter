import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { WebSocketServer, WebSocket } from "ws"
import { log } from "./app/api/(services)/logger"

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = parseInt(process.env.PORT || "3001", 10)
const wsPort = parseInt(process.env.WS_PORT || "8080", 10)

// Initialize Next.js
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// WebSocket connections per scan
const wsConnections = new Map<string, Set<WebSocket>>()

app.prepare().then(() => {
  // Create HTTP server for Next.js
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  // Create WebSocket server
  const wss = new WebSocketServer({ port: wsPort })
  log.success("WS", `WebSocket server started on port ${wsPort}`)

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://localhost:${wsPort}`)
    const scanId = url.searchParams.get("scanId")

    if (!scanId) {
      log.warn("WS", "Connection without scanId, closing")
      ws.close(1008, "Missing scanId parameter")
      return
    }

    log.info("WS", `Client connected for scan ${scanId}`)

    // Add to connections map
    if (!wsConnections.has(scanId)) {
      wsConnections.set(scanId, new Set())
    }
    wsConnections.get(scanId)!.add(ws)

    // Handle disconnection
    ws.on("close", () => {
      log.info("WS", `Client disconnected from scan ${scanId}`)
      const scanConnections = wsConnections.get(scanId)
      if (scanConnections) {
        scanConnections.delete(ws)
        if (scanConnections.size === 0) {
          wsConnections.delete(scanId)
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

  wss.on("error", (error) => {
    log.error("WS", "WebSocket server error", undefined, { error: error.message })
  })

  // Make WebSocket connections available globally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).__wsConnections = wsConnections

  // Start HTTP server
  server.listen(port, () => {
    log.success("SERVER", `Next.js server started on http://${hostname}:${port}`)
    log.success("SERVER", `WebSocket server running on ws://${hostname}:${wsPort}`)
    log.info("SERVER", `Environment: ${dev ? "development" : "production"}`)
  })

  // Graceful shutdown
  let isShuttingDown = false
  
  const shutdown = () => {
    if (isShuttingDown) {
      log.warn("SERVER", "Shutdown already in progress, forcing exit...")
      process.exit(1)
    }
    
    isShuttingDown = true
    log.info("SERVER", "Shutting down...")
    
    // Close all WebSocket connections
    for (const [scanId, connections] of wsConnections) {
      for (const ws of connections) {
        ws.close(1001, "Server shutting down")
      }
    }
    wsConnections.clear()

    // Force exit after timeout
    const forceExitTimeout = setTimeout(() => {
      log.warn("SERVER", "Graceful shutdown timeout, forcing exit...")
      process.exit(1)
    }, 5000)

    wss.close(() => {
      log.success("WS", "WebSocket server stopped")
    })

    server.close(() => {
      log.success("SERVER", "HTTP server stopped")
      clearTimeout(forceExitTimeout)
      process.exit(0)
    })
  }

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
})
