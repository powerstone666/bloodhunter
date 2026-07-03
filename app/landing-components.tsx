import React from "react"
import { Activity } from "lucide-react"
import { Badge } from "@/app/(ui)/components/badge"

export function ScanPreview() {
  return (
    <div className="rounded-2xl bg-surface-container overflow-hidden">
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-container">
            <Activity className="h-4 w-4 text-on-secondary-container" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">https://example.com</p>
            <p className="text-xs text-on-surface-variant">same-host · moderate</p>
          </div>
        </div>
        <Badge variant="primary">running</Badge>
      </div>

      <div className="grid grid-cols-3 divide-x divide-outline-variant">
        <div className="p-4">
          <p className="text-xs font-medium text-on-surface-variant mb-3">Agents</p>
          <div className="space-y-2">
            <AgentNode name="coordinator" status="running" depth={0} />
            <AgentNode name="recon-agent" status="completed" depth={1} />
            <AgentNode name="vuln-hunter-1" status="running" depth={1} />
            <AgentNode name="vuln-hunter-2" status="queued" depth={1} />
          </div>
        </div>

        <div className="col-span-2 p-4">
          <p className="text-xs font-medium text-on-surface-variant mb-3">Findings</p>
          <div className="space-y-2">
            <FindingRow
              title="SQL injection in /api/login"
              severity="critical"
              endpoint="/api/login"
            />
            <FindingRow
              title="Missing rate limiting"
              severity="medium"
              endpoint="/api/auth"
            />
            <FindingRow
              title="Server version disclosure"
              severity="low"
              endpoint="/"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AgentNode({ name, status, depth }: { name: string; status: string; depth: number }) {
  const statusColors: Record<string, string> = {
    running: "bg-primary",
    completed: "bg-tertiary",
    queued: "bg-outline",
  }

  return (
    <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 12}px` }}>
      <div className={`h-2 w-2 rounded-full ${statusColors[status] || "bg-outline"}`} />
      <span className="text-xs text-on-surface">{name}</span>
    </div>
  )
}

export function FindingRow({ title, severity, endpoint }: { title: string; severity: string; endpoint: string }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg bg-surface-variant p-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-on-surface truncate">{title}</p>
        <p className="text-xs text-on-surface-variant truncate">{endpoint}</p>
      </div>
      <Badge variant={severity === "critical" ? "error" : severity === "medium" ? "primary" : "default"}>
        {severity}
      </Badge>
    </div>
  )
}

export function EventLine({ agent, agentColor, message, timestamp }: {
  agent: string
  agentColor: string
  message: string
  timestamp: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-on-surface-variant shrink-0">{timestamp}</span>
      <span className={`text-xs font-medium shrink-0 ${agentColor}`}>{agent}</span>
      <span className="text-xs text-on-surface">{message}</span>
    </div>
  )
}

export function CapabilityBlock({ icon: Icon, title, description, color = "secondary" }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  color?: "primary" | "secondary" | "tertiary"
}) {
  const containerColors: Record<string, string> = {
    primary: "bg-primary-container",
    secondary: "bg-secondary-container",
    tertiary: "bg-tertiary-container",
  }
  const iconColors: Record<string, string> = {
    primary: "text-on-primary-container",
    secondary: "text-on-secondary-container",
    tertiary: "text-on-tertiary-container",
  }

  return (
    <div className="space-y-3">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${containerColors[color]}`}>
        <Icon className={`h-6 w-6 ${iconColors[color]}`} />
      </div>
      <div className="space-y-2">
        <h3 className="text-base font-medium text-on-surface">{title}</h3>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>
    </div>
  )
}
