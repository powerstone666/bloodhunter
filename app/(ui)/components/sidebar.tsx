"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/app/(common-lib)/lib/utils"
import {
  LayoutDashboard,
  Search,
  FileText,
  Zap,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/app/(ui)/components/button"
import { ThemeToggle } from "./theme-toggle"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scans", label: "Scans", icon: Search },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/skills", label: "Skills", icon: Zap },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-surface-container border-r border-outline-variant/30 transition-all duration-300 ease-in-out shrink-0",
        isCollapsed ? "w-16" : "w-80"
      )}
    >
      {/* Header */}
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-4 py-4 border-b border-outline-variant/30">
          <Link
            href="/"
            title="Bloodhunter Home"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary cursor-pointer hover:opacity-85 transition-opacity"
          >
            <Search className="h-5 w-5 text-on-primary" />
          </Link>
          <ThemeToggle />
          <Button
            variant="text"
            size="sm"
            className="h-10 w-10 rounded-full flex items-center justify-center p-0 text-on-surface-variant hover:bg-surface-variant cursor-pointer"
            onClick={() => setIsCollapsed(false)}
            title="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="flex h-16 items-center justify-between px-6 border-b border-outline-variant/30">
          <Link
            href="/"
            className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Search className="h-5 w-5 text-on-primary" />
            </div>
            <div>
              <p className="text-base font-medium text-on-surface">Bloodhunter</p>
              <p className="text-xs text-on-surface-variant">Security Scanner</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="text"
              size="sm"
              className="h-10 w-10 rounded-full flex items-center justify-center p-0 text-on-surface-variant hover:bg-surface-variant cursor-pointer"
              onClick={() => setIsCollapsed(true)}
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 py-4", isCollapsed ? "px-2" : "px-3")}>
        {!isCollapsed && (
          <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            Navigation
          </p>
        )}
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-full transition-all duration-200 ease-out active:scale-95 cursor-pointer",
                    isCollapsed
                      ? "h-12 w-12 justify-center"
                      : "flex-1 h-14 gap-4 px-4 text-base font-medium",
                    isActive
                      ? "bg-secondary-container text-on-secondary-container shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-variant"
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="px-6 py-4">
          <p className="text-xs text-on-surface-variant">v0.1.0</p>
        </div>
      )}
    </aside>
  )
}

