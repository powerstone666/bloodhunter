"use client"

import { useState } from "react"
import { Button } from "@/app/(ui)/components/button"
import { NewScanDialog } from "@/app/(ui)/components/new-scan-dialog"
import { Plus } from "lucide-react"

interface ScansClientProps {
  showCreateButton?: boolean
}

export function ScansClient({ showCreateButton = false }: ScansClientProps) {
  const [isNewScanOpen, setIsNewScanOpen] = useState(false)

  if (showCreateButton) {
    return (
      <>
        <Button variant="outlined" className="mt-6" onClick={() => setIsNewScanOpen(true)}>
          <Plus className="h-5 w-5" />
          Create scan
        </Button>
        <NewScanDialog open={isNewScanOpen} onClose={() => setIsNewScanOpen(false)} />
      </>
    )
  }

  return (
    <>
      <Button onClick={() => setIsNewScanOpen(true)}>
        <Plus className="h-5 w-5" />
        New scan
      </Button>
      <NewScanDialog open={isNewScanOpen} onClose={() => setIsNewScanOpen(false)} />
    </>
  )
}
