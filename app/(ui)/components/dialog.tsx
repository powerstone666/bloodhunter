"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/app/(ui)/components/button"

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => onClose()
    dialog.addEventListener("close", handleClose)
    return () => dialog.removeEventListener("close", handleClose)
  }, [onClose])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-h-[85vh] w-full max-w-2xl rounded-3xl bg-surface-container p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm animate-scale-in"
    >
      <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
        <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
        <Button
          variant="text"
          size="sm"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
      <div className="max-h-[calc(85vh-80px)] overflow-y-auto px-6 py-6">
        {children}
      </div>
    </dialog>
  )
}
