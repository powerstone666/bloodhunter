"use client"

import { useEffect, useRef, useState } from "react"
import { startScan } from "@/app/(ui)/lib/api-client"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"

interface AutoStartScanProps {
  scanId: string
  scanStatus: string
}

export function AutoStartScan({ scanId, scanStatus }: AutoStartScanProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (scanStatus !== "queued") return
    if (hasStarted.current) return

    hasStarted.current = true
    setIsStarting(true)

    let cancelled = false

    const autoStart = async () => {
      try {
        await startScan(scanId)
        if (!cancelled) {
          router.refresh()
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to auto-start scan. Click 'Start Scan' to retry.")
          setIsStarting(false)
        }
      }
    }

    autoStart()

    return () => {
      cancelled = true
    }
  }, [scanId, scanStatus, router])

  if (scanStatus !== "queued") return null

  if (isStarting && !error) return null

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-error-container p-4">
        <AlertCircle className="h-5 w-5 shrink-0 text-on-error-container mt-0.5" />
        <div>
          <p className="text-sm font-medium text-on-error-container">Auto-start failed</p>
          <p className="text-xs text-on-error-container/80 mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return null
}
