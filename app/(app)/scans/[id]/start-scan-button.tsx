"use client"

import { useState } from "react"
import { Button } from "@/app/(ui)/components/button"
import { startScan } from "@/app/(ui)/lib/api-client"
import { Play, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface StartScanButtonProps {
  scanId: string
}

export function StartScanButton({ scanId }: StartScanButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleStart = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await startScan(scanId)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="filled"
        size="sm"
        onClick={handleStart}
        disabled={isLoading}
        className="cursor-pointer"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-1" />
        )}
        {isLoading ? "Starting..." : "Start Scan"}
      </Button>
      {error && (
        <span className="text-xs text-error">{error}</span>
      )}
    </div>
  )
}
