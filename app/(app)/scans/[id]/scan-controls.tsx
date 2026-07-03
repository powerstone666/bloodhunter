"use client"

import { useState } from "react"
import { Button } from "@/app/(ui)/components/button"
import { Pause, Play, RotateCcw, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface ScanControlsProps {
  scanId: string
  status: string
}

export function ScanControls({ scanId, status }: ScanControlsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const router = useRouter()

  const handleAction = async (action: "pause" | "resume" | "retry") => {
    setIsLoading(action)
    try {
      await fetch(`/api/scans/${scanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      router.refresh()
    } catch {
      setIsLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status === "running" && (
        <Button
          variant="outlined"
          size="sm"
          onClick={() => handleAction("pause")}
          disabled={isLoading === "pause"}
          className="cursor-pointer"
        >
          {isLoading === "pause" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Pause className="h-4 w-4 mr-1" />
          )}
          Pause
        </Button>
      )}
      {status === "paused" && (
        <Button
          variant="outlined"
          size="sm"
          onClick={() => handleAction("resume")}
          disabled={isLoading === "resume"}
          className="cursor-pointer"
        >
          {isLoading === "resume" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          Resume
        </Button>
      )}
      {(status === "failed" || status === "completed") && (
        <Button
          variant="outlined"
          size="sm"
          onClick={() => handleAction("retry")}
          disabled={isLoading === "retry"}
          className="cursor-pointer"
        >
          {isLoading === "retry" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-1" />
          )}
          Retry
        </Button>
      )}
    </div>
  )
}
