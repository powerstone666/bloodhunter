"use client"

import { useState, useRef, useEffect } from "react"
import type { ScanEvent } from "@/app/(common-lib)/schemas/scan-event"
import type { Agent } from "@/app/(common-lib)/schemas/agent"
import type { Vulnerability } from "@/app/(common-lib)/schemas/vulnerability"

interface AgentNode extends Agent {
  children?: AgentNode[]
  vulnCount?: number
}

const COLORS = {
  bg: "#000000",
  border: "#333333",
  text: "#d4d4d4",
  textBright: "#e5e5e5",
  textDim: "#a3a3a3",
  textMuted: "#737373",
  green: "#22c55e",
  greenBright: "#4ade80",
  blue: "#3b82f6",
  red: "#dc2626",
  orange: "#ea580c",
  amber: "#d97706",
  yellow: "#f59e0b",
  cyan: "#06b6d4",
  purple: "#a855f7",
  hoverBg: "#1a1a1a",
}

interface ScanTerminalProps {
  events: ScanEvent[]
  agents: Agent[]
  vulnerabilities: Vulnerability[]
}

function isOperationalLog(event: ScanEvent): boolean {
  if (event.type !== "agent.log") return false

  const message = event.message.trim()
  // Hide all platform/preflight logs from terminal
  const isPlatformLog =
    event.agentId.startsWith("preflight-") ||
    message.startsWith("[API]") ||
    message.startsWith("[DOCKER]") ||
    message.startsWith("[IMAGE]") ||
    message.startsWith("[Sandbox]") ||
    message.startsWith("Agent starting") ||
    message === "Agent started" ||
    message.startsWith("Agent completed successfully") ||
    message === "Agent finished via self-termination" ||
    message === "Docker sandbox initialized — tools will execute in isolated container"

  if (isPlatformLog) return true
  return false
}

function isLowLevelToolCall(event: ScanEvent): boolean {
  return event.type === "tool.called" && event.toolName === "exec_command"
}

function isVisibleScanEvent(event: ScanEvent): boolean {
  if (isOperationalLog(event)) return false
  if (isLowLevelToolCall(event)) return false
  return true
}

export function ScanTerminal({ events, agents, vulnerabilities }: ScanTerminalProps) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [showVulnDetail, setShowVulnDetail] = useState(false)

  const [chatMessages, setChatMessages] = useState<ScanEvent[]>(events)

  // Build agent tree from flat list
  const agentTree = buildAgentTree(agents)

  useEffect(() => {
    setChatMessages(events)
  }, [events])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      const userMsg: ScanEvent = {
        scanId: "user-input",
        type: "agent.log",
        agentId: "user",
        level: "info",
        message: inputValue,
        timestamp: new Date().toISOString()
      }
      setChatMessages([...chatMessages, userMsg])
      setInputValue("")
    }
  }

  return (
    <div className="flex h-[600px]">
      {/* Chat Area - 80% */}
      <div className="flex flex-1 flex-col" style={{ width: "80%" }}>
        {/* Terminal Output */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm"
            style={{
              border: `1px solid ${COLORS.border}`,
              borderBottom: "none",
              borderRadius: "8px 8px 0 0",
              backgroundColor: COLORS.bg,
            }}
          >
            {selectedAgentId && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  Viewing:
                </span>
                <span className="text-xs font-bold" style={{ color: COLORS.green }}>
                  {selectedAgentId}
                </span>
                <button
                  className="ml-2 cursor-pointer text-xs"
                  style={{ color: COLORS.textMuted }}
                  onClick={() => setSelectedAgentId(null)}
                >
                   Show all
                </button>
              </div>
            )}
            {chatMessages.filter(isVisibleScanEvent).length === 0 && (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm italic" style={{ color: COLORS.textMuted }}>
                  Waiting for scan activity...
                </p>
              </div>
            )}
            {chatMessages
              .filter(isVisibleScanEvent)
              .filter((e) => {
                if (!selectedAgentId) return true
                if (e.type === "agent.log" || e.type === "tool.called" || e.type === "agent.spawned") {
                  return e.agentId === selectedAgentId
                }
                return e.type === "scan.created" || e.type === "scan.started" || e.type === "phase.started" || e.type === "phase.completed" || e.type === "scan.completed" || e.type === "scan.failed"
              })
              .map((event, index) => (
                <TerminalEvent key={index} event={event} />
              ))}
          </div>

          {/* Input Area */}
          <div
            className="flex items-center px-4 py-3"
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: "0 0 8px 8px",
              backgroundColor: COLORS.bg,
            }}
          >
            <span className="mr-2 font-mono text-sm" style={{ color: COLORS.textMuted }}>
              &gt;
            </span>
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="absolute inset-0 w-full bg-transparent font-mono text-sm opacity-0"
                autoFocus
              />
              <div
                className="pointer-events-none flex items-center font-mono text-sm"
                style={{ color: inputValue ? COLORS.text : COLORS.textMuted, minHeight: "20px" }}
                onClick={() => inputRef.current?.focus()}
              >
                <span>{inputValue || "Send a message to agents..."}</span>
                {!inputValue && (
                  <span
                    className="ml-0.5 inline-block h-4 w-2"
                    style={{
                      backgroundColor: COLORS.green,
                      animation: "blink 1s step-end infinite",
                    }}
                  />
                )}
                {inputValue && (
                  <span
                    className="ml-0.5 inline-block h-4 w-2"
                    style={{
                      backgroundColor: COLORS.green,
                      animation: "blink 1s step-end infinite",
                    }}
                  />
                )}
              </div>
            </div>
            <style>{`
              @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
              }
            `}</style>
          </div>
        </div>

      {/* Sidebar - 20% */}
      <div
        className="flex flex-col gap-3"
        style={{ width: "20%", marginLeft: "4px" }}
      >
          {/* Agent Tree */}
          <div
            className="flex-1 overflow-y-auto p-3"
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: "8px",
            }}
          >
            <h3
              className="mb-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: COLORS.textMuted }}
            >
              Agents
            </h3>
            <div className="space-y-1">
              {agentTree.map((agent) => (
                <AgentTreeItem
                  key={agent.id}
                  agent={agent}
                  depth={0}
                  events={chatMessages}
                  onSelect={setSelectedAgentId}
                />
              ))}
            </div>
          </div>

          {/* Vulnerabilities */}
          <div
            className="overflow-y-auto p-3"
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: "8px",
              maxHeight: "200px",
            }}
          >
            <h3
              className="mb-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: COLORS.textMuted }}
            >
              Vulnerabilities
            </h3>
            <div className="space-y-2">
              {vulnerabilities.map((vuln) => (
                <div
                  key={vuln.id}
                  className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 transition-colors hover:bg-[#1a1a1a]"
                  onClick={() => {
                    setSelectedVuln(vuln)
                    setShowVulnDetail(true)
                  }}
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getSeverityHex(vuln.severity) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: COLORS.text }}>
                      {vuln.title}
                    </p>
                    <p className="text-xs" style={{ color: COLORS.textMuted }}>
                      {vuln.severity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div
            className="overflow-y-auto p-3"
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: "8px",
              maxHeight: "240px",
            }}
          >
            <h3
              className="mb-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: COLORS.textMuted }}
            >
              Stats
            </h3>
            <div className="space-y-1">
              <StatRow label="Events" value={events.length.toString()} />
              <StatRow label="Agents" value={agents.length.toString()} />
              <StatRow label="Vulnerabilities" value={vulnerabilities.length.toString()} />
            </div>
          </div>
        </div>

      {/* Vulnerability Detail Modal */}
      {showVulnDetail && selectedVuln && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
          onClick={() => setShowVulnDetail(false)}
        >
          <div
            className="flex flex-col"
            style={{
              width: "85%",
              maxWidth: "800px",
              height: "85%",
              maxHeight: "600px",
              border: `1px solid #262626`,
              borderRadius: "8px",
              backgroundColor: "#0a0a0a",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="mb-4 text-lg font-bold" style={{ color: COLORS.orange }}>
                🐞 Vulnerability Report
              </h2>

              <div className="space-y-4">
                <FieldRow label="Title" value={selectedVuln.title} />
                <FieldRow
                  label="Severity"
                  value={selectedVuln.severity.toUpperCase()}
                  valueColor={getSeverityHex(selectedVuln.severity)}
                />
                <FieldRow
                  label="Confidence"
                  value={selectedVuln.confidence.toUpperCase()}
                  valueColor={selectedVuln.confidence === "confirmed" ? COLORS.green : selectedVuln.confidence === "likely" ? COLORS.yellow : COLORS.textDim}
                />
                <FieldRow
                  label="Status"
                  value={selectedVuln.status.replace("_", " ").toUpperCase()}
                  valueColor={getStatusHex(selectedVuln.status)}
                />
                <FieldRow label="Endpoint" value={selectedVuln.endpoint} />
                <FieldRow label="Method" value={selectedVuln.method || "N/A"} />

                <div>
                  <p className="mb-1 text-xs font-bold" style={{ color: "#4ade80" }}>
                    Description
                  </p>
                  <p className="text-sm" style={{ color: COLORS.text }}>
                    {selectedVuln.description || "No description available."}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-bold" style={{ color: "#4ade80" }}>
                    Evidence
                  </p>
                  <p className="text-sm" style={{ color: COLORS.text }}>
                    {selectedVuln.evidence || "No evidence available."}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-bold" style={{ color: "#4ade80" }}>
                    Remediation
                  </p>
                  <p className="text-sm" style={{ color: COLORS.text }}>
                    {selectedVuln.remediation || "No remediation steps available."}
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div
              className="flex items-center justify-between gap-3 border-t p-4"
              style={{ borderColor: "#1a1a1a" }}
            >
              <div className="flex items-center gap-2">
                {selectedVuln.status === "new" && (
                  <>
                    <StatusButton
                      label="Mark Reviewed"
                      targetStatus="reviewed"
                      vulnId={selectedVuln.id}
                      color={COLORS.blue}
                    />
                    <StatusButton
                      label="False Positive"
                      targetStatus="false_positive"
                      vulnId={selectedVuln.id}
                      color={COLORS.textMuted}
                    />
                  </>
                )}
                {selectedVuln.status === "reviewed" && (
                  <>
                    <StatusButton
                      label="Accept"
                      targetStatus="accepted"
                      vulnId={selectedVuln.id}
                      color={COLORS.green}
                    />
                    <StatusButton
                      label="False Positive"
                      targetStatus="false_positive"
                      vulnId={selectedVuln.id}
                      color={COLORS.textMuted}
                    />
                    <StatusButton
                      label="Mark Fixed"
                      targetStatus="fixed"
                      vulnId={selectedVuln.id}
                      color={COLORS.cyan}
                    />
                  </>
                )}
                <button
                  className="cursor-pointer rounded px-4 py-2 text-sm font-medium transition-colors hover:bg-[#1a1a1a]"
                  style={{ color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                  onClick={() => {
                    navigator.clipboard.writeText(selectedVuln.title || "")
                  }}
                >
                  Copy
                </button>
              </div>
              <button
                className="cursor-pointer rounded px-4 py-2 text-sm font-medium transition-colors hover:bg-[#1a1a1a]"
                style={{ color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                onClick={() => setShowVulnDetail(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-bold" style={{ color: "#4ade80" }}>
        {label}:
      </span>
      <span className="text-sm" style={{ color: valueColor || COLORS.text }}>
        {value}
      </span>
    </div>
  )
}

function buildAgentTree(agents: Agent[]): AgentNode[] {
  const agentMap = new Map<string, AgentNode>()
  const roots: AgentNode[] = []

  agents.forEach(agent => {
    agentMap.set(agent.id, { ...agent, children: [] })
  })

  agents.forEach(agent => {
    const node = agentMap.get(agent.id)!
    if (agent.parentId && agentMap.has(agent.parentId)) {
      agentMap.get(agent.parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

function TerminalEvent({ event }: { event: ScanEvent }) {
  if (event.type === "scan.created" || event.type === "scan.started") {
    return (
      <div className="mb-3">
        <span style={{ color: COLORS.textMuted }}>◆ </span>
        <span style={{ color: COLORS.textMuted }}>Scan {event.type === "scan.created" ? "created" : "started"}</span>
      </div>
    )
  }

  if (event.type === "phase.started" || event.type === "phase.completed") {
    return (
      <div className="mb-3">
        <span style={{ color: COLORS.blue }}>◆ </span>
        <span style={{ color: COLORS.blue }}>Phase {event.phase} {event.type === "phase.started" ? "started" : "completed"}</span>
      </div>
    )
  }

  if (event.type === "agent.spawned") {
    return (
      <div className="mb-3">
        <span style={{ color: COLORS.green }}>◆ </span>
        <span style={{ color: COLORS.green }}>Agent spawned: {event.name}</span>
      </div>
    )
  }

  if (event.type === "agent.log") {
    const levelColors = {
      info: COLORS.text,
      warn: COLORS.yellow,
      error: COLORS.red,
      success: COLORS.green
    }
    return (
      <div className="mb-3">
        <div>
          <span style={{ color: levelColors[event.level] }}>[{event.level.toUpperCase()}]</span>
          <span style={{ color: COLORS.textMuted }}> ({event.agentId})</span>
        </div>
        <div className="ml-4" style={{ color: COLORS.text }}>
          {event.message}
        </div>
      </div>
    )
  }

  if (event.type === "tool.called") {
    return (
      <div className="mb-3">
        <div>
          <span style={{ color: COLORS.green }}>● </span>
          <span className="font-bold" style={{ color: COLORS.green }}>
            {event.toolName}
          </span>
          <span style={{ color: COLORS.textMuted }}> ({event.agentId})</span>
        </div>
        <div className="ml-4" style={{ color: COLORS.textMuted }}>
          {event.summary}
        </div>
      </div>
    )
  }

  if (event.type === "finding.created") {
    const sevColor = getSeverityHex(event.severity)
    return (
      <div className="mb-3">
        <div className="font-bold" style={{ color: sevColor }}>
          🐞 {event.title}
        </div>
        <div className="ml-4" style={{ color: sevColor }}>
          [{event.severity}]
        </div>
      </div>
    )
  }

  if (event.type === "scan.completed") {
    return (
      <div className="mb-3">
        <span style={{ color: COLORS.green }}>✓ </span>
        <span style={{ color: COLORS.green }}>Scan completed</span>
      </div>
    )
  }

  if (event.type === "scan.failed") {
    return (
      <div className="mb-3">
        <span style={{ color: COLORS.red }}>✗ </span>
        <span style={{ color: COLORS.red }}>Scan failed: {event.error}</span>
      </div>
    )
  }

  return null
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: COLORS.textMuted }}>{label}</span>
      <span className="text-xs font-mono" style={{ color: COLORS.text }}>{value}</span>
    </div>
  )
}

function AgentTreeItem({
  agent,
  depth,
  events,
  onSelect,
}: {
  agent: AgentNode
  depth: number
  events: ScanEvent[]
  onSelect: (id: string) => void
}) {
  const depthColors = [COLORS.text, COLORS.textDim, COLORS.textMuted]
  const color = depthColors[Math.min(depth, depthColors.length - 1)]
  return (
    <div style={{ paddingLeft: `${depth * 12}px` }}>
      <div
        className="cursor-pointer rounded px-1 py-1 transition-colors hover:bg-[#1a1a1a]"
        onClick={() => onSelect(agent.id)}
      >
        <div className="flex items-center gap-2">
          <AgentStatusDot status={agent.status} />
          <span className="text-xs font-medium" style={{ color }}>
            {agent.name}
          </span>
          <span className="text-[10px] uppercase" style={{ color: getAgentStatusColor(agent.status) }}>
            {agent.status}
          </span>
          {agent.vulnCount && agent.vulnCount > 0 && (
            <span className="text-xs" style={{ color: COLORS.textMuted }}>
              ({agent.vulnCount})
            </span>
          )}
        </div>
      </div>
      {agent.children?.map((child) => (
        <AgentTreeItem key={child.id} agent={child} depth={depth + 1} events={events} onSelect={onSelect} />
      ))}
    </div>
  )
}

function AgentStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "#f59e0b",
    waiting: "#737373",
    completed: "#22c55e",
    failed: "#dc2626",
    stopped: "#525252",
  }
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: colors[status] || colors.waiting }}
    />
  )
}

function getAgentStatusColor(status: string): string {
  switch (status) {
    case "running": return COLORS.amber
    case "completed": return COLORS.green
    case "failed": return COLORS.red
    case "cancelled": return COLORS.textMuted
    default: return COLORS.textMuted
  }
}

function getSeverityHex(severity?: string): string {
  switch (severity) {
    case "critical": return "#dc2626"
    case "high": return "#ea580c"
    case "medium": return "#d97706"
    case "low": return "#22c55e"
    case "info": return "#3b82f6"
    default: return "#6b7280"
  }
}

function getStatusHex(status?: string): string {
  switch (status) {
    case "new": return "#f59e0b"
    case "reviewed": return "#3b82f6"
    case "accepted": return "#22c55e"
    case "false_positive": return "#6b7280"
    case "fixed": return "#06b6d4"
    default: return "#6b7280"
  }
}

function StatusButton({ label, targetStatus, vulnId, color }: { label: string; targetStatus: string; vulnId: string; color: string }) {
  const [updating, setUpdating] = useState(false)

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      await fetch(`/api/vulnerabilities/${vulnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      })
      window.location.reload()
    } catch {
      setUpdating(false)
    }
  }

  return (
    <button
      className="cursor-pointer rounded px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#1a1a1a]"
      style={{ color, border: `1px solid ${color}33` }}
      onClick={handleUpdate}
      disabled={updating}
    >
      {updating ? "..." : label}
    </button>
  )
}
