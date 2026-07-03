"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Trash2 } from "lucide-react"
import { Badge } from "@/app/(ui)/components/badge"
import { Button } from "@/app/(ui)/components/button"
import { Dialog } from "@/app/(ui)/components/dialog"
import { ScansClient } from "./scans-client"
import { deleteScan } from "@/app/(ui)/lib/api-client"
import type { Scan } from "@/app/(common-lib)/schemas"

interface ScanListProps {
  scans: Scan[]
  emptyIcon: React.ComponentType<{ className?: string }>
  emptyMessage: string
}

export function ScanList({ scans, emptyIcon: EmptyIcon, emptyMessage }: ScanListProps) {
  const router = useRouter()
  const [scanToDelete, setScanToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!scanToDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      await deleteScan(scanToDelete)
      setScanToDelete(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete scan")
    } finally {
      setIsDeleting(false)
    }
  }

  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-container">
          <EmptyIcon className="h-8 w-8 text-on-secondary-container" />
        </div>
        <p className="mt-4 text-base text-on-surface-variant">{emptyMessage}</p>
        <ScansClient showCreateButton />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {scans.map((scan) => (
          <Link
            key={scan.id}
            href={`/scans/${scan.id}`}
            className="block rounded-2xl bg-surface-container p-4 border border-transparent transition-all duration-300 ease-out hover:scale-[1.01] hover:shadow-md hover:bg-surface-variant hover:border-outline-variant/30 active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-container">
                  <Search className="h-6 w-6 text-on-secondary-container" />
                </div>
                <div>
                  <p className="text-base font-medium text-on-surface">{scan.config.targetUrl}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
                    <span>{scan.config.scopeMode}</span>
                    <span>·</span>
                    <span>{scan.config.aggressiveness}</span>
                    {scan.config.maxDepth && (
                      <>
                        <span>·</span>
                        <span>Depth {scan.config.maxDepth}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={getScanBadgeVariant(scan.status)}>
                  {scan.status}
                </Badge>
                <div className="text-right">
                  <p className="text-xs text-on-surface-variant">
                    {new Date(scan.createdAt).toISOString().split('T')[0]}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(scan.createdAt).toISOString().split('T')[1].substring(0, 5)}
                  </p>
                </div>
                <Button
                  variant="text"
                  size="sm"
                  className="text-on-surface-variant hover:bg-error/8 hover:text-error focus:ring-error rounded-full p-2 h-10 w-10 flex items-center justify-center cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setScanToDelete(scan.id)
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Dialog
        open={!!scanToDelete}
        onClose={() => !isDeleting && setScanToDelete(null)}
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
              onClick={() => setScanToDelete(null)}
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

function getScanBadgeVariant(status: string): "default" | "primary" | "secondary" | "error" {
  switch (status) {
    case "running":
      return "primary"
    case "completed":
      return "secondary"
    case "failed":
      return "error"
    default:
      return "default"
  }
}
