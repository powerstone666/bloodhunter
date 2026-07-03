"use client"

import { useState } from "react"
import { Button } from "@/app/(ui)/components/button"
import { NewScanDialog } from "@/app/(ui)/components/new-scan-dialog"
import { Search } from "lucide-react"

interface DashboardClientProps {
  showCreateLink?: boolean
}

export function DashboardClient({ showCreateLink = false }: DashboardClientProps) {
  const [isNewScanOpen, setIsNewScanOpen] = useState(false)

  if (showCreateLink) {
    return (
      <>
        <button
          onClick={() => setIsNewScanOpen(true)}
          className="mt-2 inline-block text-sm font-medium text-primary hover:text-on-primary-container cursor-pointer"
        >
          Create your first scan
        </button>
        <NewScanDialog open={isNewScanOpen} onClose={() => setIsNewScanOpen(false)} />
      </>
    )
  }

  return (
    <>
      <Button size="lg" onClick={() => setIsNewScanOpen(true)}>
        <Search className="h-5 w-5" />
        New scan
      </Button>
      <NewScanDialog open={isNewScanOpen} onClose={() => setIsNewScanOpen(false)} />
    </>
  )
}
