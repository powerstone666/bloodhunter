"use client"

import { cn } from "@/app/(common-lib)/lib/utils"

export interface DropdownMenuProps {
  children: React.ReactNode
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  return <div className="relative">{children}</div>
}

export interface DropdownMenuTriggerProps {
  children: React.ReactNode
  onClick?: () => void
}

export function DropdownMenuTrigger({ children, onClick }: DropdownMenuTriggerProps) {
  return <div onClick={onClick}>{children}</div>
}

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end"
}

export function DropdownMenuContent({ className, align = "end", children, ...props }: DropdownMenuContentProps) {
  return (
    <div
      className={cn(
        "absolute z-50 mt-2 min-w-[180px] rounded-xl bg-surface-container py-2 shadow-lg animate-scale-in",
        align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type DropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function DropdownMenuItem({ className, children, ...props }: DropdownMenuItemProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-base text-on-surface cursor-pointer",
        "hover:bg-surface-variant",
        "focus:bg-surface-variant focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
