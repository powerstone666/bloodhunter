"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/(ui)/components/button"
import { Dialog } from "@/app/(ui)/components/dialog"
import { deleteScan } from "@/app/(ui)/lib/api-client"
import { Trash2 } from "lucide-react"

interface DeleteScanButtonProps {
  scanId: string
}

export function DeleteScanButton({ scanId }: DeleteScanButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await deleteScan(scanId)
      setIsOpen(false)
      router.push("/scans")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete scan")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        onClick={() => setIsOpen(true)}
        className="border-error text-error hover:bg-error/8 hover:text-error focus:ring-error"
        size="sm"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Delete Scan
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => !isDeleting && setIsOpen(false)}
        title="Delete scan"
      >
        <div className="space-y-4">
          <p className="text-base text-on-surface-variant">
            Are you sure you want to delete this scan? This will permanently delete the scan and all of its associated vulnerabilities, agent logs, and event streams. This action cannot be undone.
          </p>

          {error && (
            <div className="rounded-xl bg-error-container p-3 text-sm text-on-error-container">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
            <Button
              variant="outlined"
              onClick={() => setIsOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="filled"
              className="bg-error text-on-error hover:bg-error/90 focus:ring-error"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
