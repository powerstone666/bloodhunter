import { writeFile, readFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { dirname } from "path"
import { log } from "./logger"

export type AgentStatus = "running" | "waiting" | "completed" | "stopped" | "crashed" | "failed"

export interface AgentRuntime {
  sessionId?: string
  taskId?: string
  streamId?: string
  interruptOnMessage: boolean
  wake: boolean
}

export interface AgentMetadata {
  task?: string
  skills?: string[]
}

export interface CoordinatorSnapshot {
  statuses: Record<string, AgentStatus>
  parentOf: Record<string, string | null>
  names: Record<string, string>
  metadata: Record<string, AgentMetadata>
  pendingCounts: Record<string, number>
}

export class AgentCoordinator {
  private statuses = new Map<string, AgentStatus>()
  private parentOf = new Map<string, string | null>()
  private names = new Map<string, string>()
  private metadata = new Map<string, AgentMetadata>()
  private pendingCounts = new Map<string, number>()
  private runtimes = new Map<string, AgentRuntime>()
  private snapshotPath?: string
  private isShuttingDown = false
  private budgetStopped = false

  setSnapshotPath(path: string): void {
    this.snapshotPath = path
  }

  markShuttingDown(): void {
    this.isShuttingDown = true
  }

  isBudgetStopped(): boolean {
    return this.budgetStopped
  }

  async triggerBudgetStop(): Promise<void> {
    this.budgetStopped = true
    for (const runtime of this.runtimes.values()) {
      runtime.wake = true
    }
    await this.maybeSnapshot()
  }

  async register(
    agentId: string,
    name: string,
    parentId: string | null,
    options?: { task?: string; skills?: string[] }
  ): Promise<void> {
    this.statuses.set(agentId, "running")
    this.parentOf.set(agentId, parentId)
    this.names.set(agentId, name)
    this.pendingCounts.set(agentId, 0)
    this.metadata.set(agentId, {
      task: options?.task || "",
      skills: options?.skills || [],
    })
    this.runtimes.set(agentId, { interruptOnMessage: false, wake: false })
    
    log.info("AGENT", "Registered agent", { agentId, name, parentId: parentId || "-" })
    await this.maybeSnapshot()
  }

  async attachRuntime(
    agentId: string,
    options: {
      sessionId?: string
      taskId?: string
      streamId?: string
      interruptOnMessage?: boolean
    }
  ): Promise<void> {
    const runtime = this.runtimes.get(agentId) || { interruptOnMessage: false, wake: false }
    if (options.sessionId !== undefined) runtime.sessionId = options.sessionId
    if (options.taskId !== undefined) runtime.taskId = options.taskId
    if (options.streamId !== undefined) runtime.streamId = options.streamId
    if (options.interruptOnMessage !== undefined) runtime.interruptOnMessage = options.interruptOnMessage
    this.runtimes.set(agentId, runtime)
  }

  async markRunning(agentId: string): Promise<void> {
    if (this.statuses.has(agentId)) {
      this.statuses.set(agentId, "running")
    }
    await this.maybeSnapshot()
  }

  async parkWaiting(agentId: string): Promise<void> {
    await this.setStatus(agentId, "waiting")
  }

  async setStatus(agentId: string, status: AgentStatus): Promise<void> {
    if (!this.statuses.has(agentId)) return
    this.statuses.set(agentId, status)
    const runtime = this.runtimes.get(agentId) || { interruptOnMessage: false, wake: false }
    runtime.wake = true
    this.runtimes.set(agentId, runtime)
    
    log.info("AGENT", "Status changed", { agentId, status })
    await this.maybeSnapshot()
  }

  async send(targetAgentId: string, _message: Record<string, unknown>): Promise<boolean> {
    if (!this.statuses.has(targetAgentId)) {
      log.debug("AGENT", "Message dropped - unknown target", { targetAgentId })
      return false
    }

    const runtime = this.runtimes.get(targetAgentId)
    if (!runtime?.sessionId) {
      log.warn("AGENT", "Message dropped - no session", { targetAgentId })
      return false
    }

    // In a real implementation, we would send the message to the target agent's session
    // For now, we just log it
    log.debug("AGENT", "Message sent", { targetAgentId })

    // In a real implementation, we'd append to the SDK session here
    // For now, we just increment pending count and wake the agent
    const pending = this.pendingCounts.get(targetAgentId) || 0
    this.pendingCounts.set(targetAgentId, pending + 1)
    
    const rt = this.runtimes.get(targetAgentId) || { interruptOnMessage: false, wake: false }
    rt.wake = true
    this.runtimes.set(targetAgentId, rt)

    await this.maybeSnapshot()
    return true
  }

  async waitForMessage(agentId: string): Promise<void> {
    while (true) {
      if (this.budgetStopped || (this.pendingCounts.get(agentId) || 0) > 0) {
        return
      }
      const runtime = this.runtimes.get(agentId) || { interruptOnMessage: false, wake: false }
      runtime.wake = false
      this.runtimes.set(agentId, runtime)
      
      // In a real implementation, we'd wait on an async event
      // For now, we just return immediately
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  async consumePending(agentId: string): Promise<number> {
    const count = this.pendingCounts.get(agentId) || 0
    this.pendingCounts.set(agentId, 0)
    if (count > 0) {
      await this.maybeSnapshot()
    }
    return count
  }

  async requestStop(agentId: string): Promise<void> {
    if (!this.statuses.has(agentId)) return
    this.statuses.set(agentId, "stopped")
    const runtime = this.runtimes.get(agentId) || { interruptOnMessage: false, wake: false }
    runtime.wake = true
    this.runtimes.set(agentId, runtime)
    await this.maybeSnapshot()
  }

  async cancelDescendants(agentId: string): Promise<void> {
    const order = this.getSubtreeOrder(agentId)
    for (const aid of order.reverse()) {
      await this.requestStop(aid)
    }
  }

  async cancelDescendantsGraceful(agentId: string): Promise<void> {
    const order = this.getSubtreeOrder(agentId)
    for (const aid of order.reverse()) {
      await this.requestStop(aid)
    }
    await this.maybeSnapshot()
  }

  async attachStream(agentId: string, streamId: string): Promise<void> {
    const runtime = this.runtimes.get(agentId) || { interruptOnMessage: false, wake: false }
    runtime.streamId = streamId
    this.runtimes.set(agentId, runtime)
  }

  async detachStream(agentId: string, streamId: string): Promise<void> {
    const runtime = this.runtimes.get(agentId)
    if (runtime?.streamId === streamId) {
      runtime.streamId = undefined
      this.runtimes.set(agentId, runtime)
    }
  }

  async activeAgentsExcept(agentId: string): Promise<Array<{ agentId: string; name: string; status: AgentStatus; parentId: string | null }>> {
    const result = []
    for (const [aid, status] of this.statuses) {
      if (aid !== agentId && (status === "running" || status === "waiting")) {
        result.push({
          agentId: aid,
          name: this.names.get(aid) || aid,
          status,
          parentId: this.parentOf.get(aid) || null,
        })
      }
    }
    return result
  }

  async graphSnapshot(): Promise<{
    parentOf: Record<string, string | null>
    statuses: Record<string, AgentStatus>
    names: Record<string, string>
  }> {
    return {
      parentOf: Object.fromEntries(this.parentOf),
      statuses: Object.fromEntries(this.statuses),
      names: Object.fromEntries(this.names),
    }
  }

  async snapshot(): Promise<CoordinatorSnapshot> {
    return {
      statuses: Object.fromEntries(this.statuses),
      parentOf: Object.fromEntries(this.parentOf),
      names: Object.fromEntries(this.names),
      metadata: Object.fromEntries(this.metadata),
      pendingCounts: Object.fromEntries(this.pendingCounts),
    }
  }

  async restore(snap: CoordinatorSnapshot): Promise<void> {
    this.statuses = new Map(Object.entries(snap.statuses))
    this.parentOf = new Map(Object.entries(snap.parentOf))
    this.names = new Map(Object.entries(snap.names))
    this.metadata = new Map(Object.entries(snap.metadata))
    this.pendingCounts = new Map(Object.entries(snap.pendingCounts))
    
    for (const agentId of this.statuses.keys()) {
      this.runtimes.set(agentId, { interruptOnMessage: false, wake: false })
    }
  }

  private async maybeSnapshot(): Promise<void> {
    if (!this.snapshotPath) return
    
    try {
      const snap = await this.snapshot()
      const payload = JSON.stringify(snap, null, 2)
      
      const dir = dirname(this.snapshotPath)
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
      
      await writeFile(this.snapshotPath, payload, "utf-8")
    } catch (error) {
      log.error("AGENT", "Failed to write coordinator snapshot", undefined, {
        error: error instanceof Error ? error.message : String(error),
        path: this.snapshotPath,
      })
    }
  }

  async loadSnapshot(): Promise<boolean> {
    if (!this.snapshotPath || !existsSync(this.snapshotPath)) {
      return false
    }

    try {
      const payload = await readFile(this.snapshotPath, "utf-8")
      const snap = JSON.parse(payload) as CoordinatorSnapshot
      await this.restore(snap)
      return true
    } catch (error) {
      log.error("AGENT", "Failed to load coordinator snapshot", undefined, {
        error: error instanceof Error ? error.message : String(error),
        path: this.snapshotPath,
      })
      return false
    }
  }

  private getSubtreeOrder(agentId: string): string[] {
    const queue = [agentId]
    const order: string[] = []
    
    while (queue.length > 0) {
      const aid = queue.pop()!
      order.push(aid)
      
      for (const [child, parent] of this.parentOf) {
        if (parent === aid) {
          queue.push(child)
        }
      }
    }
    
    return order
  }

  getStatus(agentId: string): AgentStatus | undefined {
    return this.statuses.get(agentId)
  }

  getName(agentId: string): string | undefined {
    return this.names.get(agentId)
  }

  getParent(agentId: string): string | null | undefined {
    return this.parentOf.get(agentId)
  }

  getMetadata(agentId: string): AgentMetadata | undefined {
    return this.metadata.get(agentId)
  }

  getAllAgents(): Array<{ agentId: string; name: string; status: AgentStatus; parentId: string | null }> {
    const result = []
    for (const [agentId, status] of this.statuses) {
      result.push({
        agentId,
        name: this.names.get(agentId) || agentId,
        status,
        parentId: this.parentOf.get(agentId) || null,
      })
    }
    return result
  }
}
