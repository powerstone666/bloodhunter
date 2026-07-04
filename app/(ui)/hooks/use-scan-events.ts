"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface UseScanEventsOptions {
  scanId: string
  enabled?: boolean
}

interface UseScanEventsReturn {
  events: ScanEvent[]
  isConnected: boolean
  connectionError: string | null
  addLocalEvent: (event: ScanEvent) => void
  clearEvents: () => void
}

export function useScanEvents({
  scanId,
  enabled = true,
}: UseScanEventsOptions): UseScanEventsReturn {
  const [events, setEvents] = useState<ScanEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const connectRef = useRef<() => void>(() => {})
  const maxReconnectAttempts = 5
  const reconnectDelay = 2000

  const connect = useCallback(() => {
    if (!enabled || !scanId) return

    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || "8080"
    const wsUrl = `ws://localhost:${wsPort}?scanId=${scanId}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[WS] Connected to scan events")
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle connection confirmation
          if (data.type === "connected") {
            console.log("[WS] Connection confirmed for scan:", data.scanId)
            return
          }

          // Add scan event to state
          setEvents((prev) => [...prev, data as ScanEvent])
        } catch (error) {
          console.error("[WS] Failed to parse message:", error)
        }
      }

      ws.onerror = (error) => {
        console.error("[WS] Connection error:", error)
        setConnectionError("WebSocket connection error")
      }

      ws.onclose = (event) => {
        console.log("[WS] Connection closed:", event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null

        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          console.log(`[WS] Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current()
          }, reconnectDelay)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError("Failed to reconnect after multiple attempts")
        }
      }
    } catch (error) {
      console.error("[WS] Failed to create WebSocket:", error)
      setConnectionError("Failed to create WebSocket connection")
    }
  }, [scanId, enabled])

  // Update the ref whenever connect changes
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    const connectFn = connectRef.current
    connectFn()

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting")
        wsRef.current = null
      }
    }
  }, [])

  const addLocalEvent = useCallback((event: ScanEvent) => {
    setEvents((prev) => [...prev, event])
  }, [])

  const clearEvents = useCallback(() => {
    setEvents([])
  }, [])

  return {
    events,
    isConnected,
    connectionError,
    addLocalEvent,
    clearEvents,
  }
}
