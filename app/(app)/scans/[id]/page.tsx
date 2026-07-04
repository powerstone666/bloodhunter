import { Button } from "@/app/(ui)/components/button"
import { Badge } from "@/app/(ui)/components/badge"
import { ScanTerminal } from "@/app/(ui)/components/scan-terminal"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { getScanById } from "@/app/api/(db)/scans-repository"
import { getScanEvents } from "@/app/api/(db)/scan-events-repository"
import { getVulnerabilitiesByScanId } from "@/app/api/(db)/vulnerabilities-repository"
import { getAgentsByScanId } from "@/app/api/(db)/agents-repository"
import { getEndpointsByScanId } from "@/app/api/(db)/endpoints-repository"
import { getNodesByScanId, getEdgesByScanId } from "@/app/api/(db)/graph-repository"
import { buildGraphFromScanData } from "@/app/api/(services)/graph-service"
import Link from "next/link"
import { ArrowLeft, Activity, Clock, Globe, Layers, Zap, AlertTriangle, CheckCircle } from "lucide-react"
import { DeleteScanButton } from "./delete-button"
import { ScanControls } from "./scan-controls"
import { AutoStartScan } from "./auto-start-scan"

interface ScanDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ScanDetailPage({ params }: ScanDetailPageProps) {
  const { id } = await params
  const scan = getScanById(id)
  const events = getScanEvents(id)
  const vulnerabilities = getVulnerabilitiesByScanId(id)
  const agents = getAgentsByScanId(id)
  const endpoints = getEndpointsByScanId(id)

  buildGraphFromScanData(id)
  const graphNodes = getNodesByScanId(id)
  const graphEdges = getEdgesByScanId(id)

  const failureMessage = getFailureMessage(events)

  const latestPreflightMessage = [...events]
    .reverse()
    .find((event): event is Extract<ScanEvent, { type: "agent.log" }> => {
      if (event.type !== "agent.log") return false
      return event.message.startsWith("[API]") || event.message.startsWith("[DOCKER]") || event.message.startsWith("[IMAGE]") || event.message.startsWith("[Sandbox]")
    })?.message || ""

  if (!scan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/scans" className="cursor-pointer">
            <Button variant="text" size="sm">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-normal tracking-tight text-on-surface">Scan Not Found</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              The requested scan does not exist or has been removed
            </p>
          </div>
        </div>
        <Link href="/scans" className="cursor-pointer">
          <Button variant="outlined">
            Back to Scans
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/scans" className="cursor-pointer">
          <Button variant="text" size="sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal tracking-tight text-on-surface">
              {scan.config.targetUrl}
            </h1>
            <Badge variant={getScanBadgeVariant(scan.status)}>
              {scan.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">{scan.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <DeleteScanButton scanId={scan.id} />
        </div>
      </div>

      <AutoStartScan scanId={scan.id} scanStatus={scan.status} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl bg-surface-container p-6 lg:col-span-2">
          <h2 className="text-xl font-normal text-on-surface">Configuration</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigItem
              icon={Globe}
              label="Scope"
              value={scan.config.scopeMode}
            />
            <ConfigItem
              icon={Zap}
              label="Aggressiveness"
              value={scan.config.aggressiveness}
            />
            <ConfigItem
              icon={Layers}
              label="Max Depth"
              value={scan.config.maxDepth?.toString() || "Unlimited"}
            />
            <ConfigItem
              icon={Activity}
              label="Max Agents"
              value={scan.config.maxAgents?.toString() || "Unlimited"}
            />
            <ConfigItem
              icon={Clock}
              label="Created"
              value={new Date(scan.createdAt).toLocaleString()}
            />
            <ConfigItem
              icon={Clock}
              label="Updated"
              value={new Date(scan.updatedAt).toLocaleString()}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-surface-container p-6">
          <h2 className="text-xl font-normal text-on-surface">Quick Stats</h2>
          <div className="space-y-3">
            <StatItem label="Endpoints Found" value={endpoints.length > 0 ? endpoints.length.toString() : "—"} />
            <StatItem label="Vulnerabilities" value={vulnerabilities.length > 0 ? vulnerabilities.length.toString() : "—"} />
            <StatItem label="Agents Spawned" value={agents.length > 0 ? agents.length.toString() : "—"} />
          </div>
        </section>
      </div>

      {endpoints.length > 0 && (
        <section className="rounded-2xl bg-surface-container p-6">
          <h2 className="text-xl font-normal text-on-surface mb-4">Discovered Endpoints</h2>
          <div className="space-y-2">
            {endpoints.map((ep) => (
              <div
                key={ep.id}
                className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3"
              >
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                  ep.method === "GET" ? "bg-green-500/10 text-green-400" :
                  ep.method === "POST" ? "bg-blue-500/10 text-blue-400" :
                  ep.method === "PUT" ? "bg-yellow-500/10 text-yellow-400" :
                  ep.method === "DELETE" ? "bg-red-500/10 text-red-400" :
                  "bg-gray-500/10 text-gray-400"
                }`}>
                  {ep.method}
                </span>
                <span className="text-sm text-on-surface font-mono truncate flex-1">{ep.url}</span>
                {ep.statusCode && (
                  <span className={`text-xs font-medium ${
                    ep.statusCode >= 200 && ep.statusCode < 300 ? "text-green-400" :
                    ep.statusCode >= 300 && ep.statusCode < 400 ? "text-yellow-400" :
                    ep.statusCode >= 400 ? "text-red-400" : "text-on-surface-variant"
                  }`}>
                    {ep.statusCode}
                  </span>
                )}
                {ep.title && (
                  <span className="text-xs text-on-surface-variant truncate max-w-[200px]">{ep.title}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {graphNodes.length > 0 && (
        <section className="rounded-2xl bg-surface-container p-6">
          <h2 className="text-xl font-normal text-on-surface mb-4">Attack Surface Graph</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-surface-container-high p-4">
              <p className="text-xs text-on-surface-variant">Total Nodes</p>
              <p className="text-2xl font-medium text-on-surface">{graphNodes.length}</p>
            </div>
            <div className="rounded-xl bg-surface-container-high p-4">
              <p className="text-xs text-on-surface-variant">Total Edges</p>
              <p className="text-2xl font-medium text-on-surface">{graphEdges.length}</p>
            </div>
            <div className="rounded-xl bg-surface-container-high p-4">
              <p className="text-xs text-on-surface-variant">Node Types</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(
                  graphNodes.reduce((acc, n) => {
                    acc[n.nodeType] = (acc[n.nodeType] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <span key={type} className="inline-flex items-center rounded-md bg-secondary-container px-2 py-0.5 text-xs text-on-secondary-container">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 max-h-48 overflow-y-auto rounded-xl bg-surface-container-high">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline/20 text-left text-xs text-on-surface-variant">
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Label</th>
                  <th className="px-4 py-2">Connections</th>
                </tr>
              </thead>
              <tbody>
                {graphNodes.slice(0, 20).map((node) => {
                  const outEdges = graphEdges.filter(e => e.sourceId === node.id).length
                  const inEdges = graphEdges.filter(e => e.targetId === node.id).length
                  return (
                    <tr key={node.id} className="border-b border-outline/10">
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          node.nodeType === "endpoint" ? "bg-green-500/10 text-green-400" :
                          node.nodeType === "finding" ? "bg-red-500/10 text-red-400" :
                          node.nodeType === "technology" ? "bg-blue-500/10 text-blue-400" :
                          "bg-gray-500/10 text-gray-400"
                        }`}>
                          {node.nodeType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-on-surface truncate max-w-[300px]">{node.label}</td>
                      <td className="px-4 py-2 text-on-surface-variant">{outEdges} out / {inEdges} in</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Terminal - only show when agent is running */}
      {scan.status === "running" && (
        <section className="rounded-2xl bg-surface-container p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xl font-normal text-on-surface">Live Stream</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Real-time scan events and agent interactions
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-black p-4">
            <ScanTerminal 
              scanId={scan.id}
              initialEvents={events} 
              agents={agents} 
              vulnerabilities={vulnerabilities} 
            />
          </div>
        </section>
      )}

      {/* Initializing state - preflight running */}
      {scan.status === "queued" && (
        <section className="rounded-2xl bg-surface-container p-6">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-secondary-container flex items-center justify-center">
                <Activity className="h-8 w-8 text-on-secondary-container animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary animate-ping" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-on-surface">Initializing scan</h3>
            <p className="mt-2 text-sm text-on-surface-variant text-center max-w-md">
              Validating API key, checking Docker, and preparing sandbox environment...
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            {latestPreflightMessage && (
              <p className="mt-4 text-xs font-mono text-on-surface-variant bg-surface-container-high rounded-lg px-4 py-2 max-w-lg text-center">
                {latestPreflightMessage}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Failed state */}
      {scan.status === "failed" && (
        <section className="rounded-2xl bg-surface-container p-6">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-error-container flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-on-error-container" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-on-surface">Scan failed</h3>
            <p className="mt-2 text-sm text-error text-center max-w-lg whitespace-pre-line">
              {failureMessage}
            </p>
            <div className="mt-6">
              <ScanControls scanId={scan.id} status={scan.status} />
            </div>
          </div>
        </section>
      )}

      {/* Completed state */}
      {scan.status === "completed" && (
        <section className="rounded-2xl bg-surface-container p-6">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-success-container flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-on-success-container" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-on-surface">Scan completed</h3>
            <p className="mt-2 text-sm text-on-surface-variant text-center max-w-md">
              Review the findings above. {vulnerabilities.length > 0 ? `${vulnerabilities.length} vulnerability${vulnerabilities.length !== 1 ? 'ies' : 'y'} found.` : 'No vulnerabilities found.'}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

function getFailureMessage(events: ReturnType<typeof getScanEvents>): string {
  const failedEvent = [...events]
    .reverse()
    .find((event): event is Extract<(typeof events)[number], { type: "scan.failed" }> => {
      if (event.type !== "scan.failed") return false
      return typeof event.error === "string" && event.error.trim().length > 0
    })

  if (failedEvent) {
    return typeof failedEvent.error === "string" ? failedEvent.error : "Scan failed"
  }

  const errorLog = [...events]
    .reverse()
    .find((event): event is Extract<(typeof events)[number], { type: "agent.log" }> => {
      if (event.type !== "agent.log") return false
      return event.level === "error" && event.message.trim().length > 0
    })

  return errorLog?.message ?? "Scan failed, but no error details were recorded."
}

function ConfigItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container">
        <Icon className="h-5 w-5 text-on-secondary-container" />
      </div>
      <div>
        <p className="text-xs text-on-surface-variant">{label}</p>
        <p className="text-sm font-medium text-on-surface">{value}</p>
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="text-sm font-medium text-on-surface">{value}</span>
    </div>
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
